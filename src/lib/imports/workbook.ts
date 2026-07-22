import { Readable } from "node:stream";

import ExcelJS from "exceljs";
import yauzl from "yauzl";

import type {
  ExcelCellValue,
  ExcelMapping,
  ExcelPreviewRow,
  ExcelSheetPreview,
  ExcelWorkbookPreview,
} from "@/lib/imports/types";

export const MAX_WORKBOOK_BYTES = 10 * 1024 * 1024;
export const MAX_WORKBOOK_SHEETS = 20;
export const MAX_WORKBOOK_ROWS = 500;
export const MAX_WORKBOOK_COLUMNS = 200;
export const MAX_WORKBOOK_CELL_CHARACTERS = 20_000;
export const MAX_WORKBOOK_HEADER_CHARACTERS = 200;
export const MAX_WORKBOOK_LOGICAL_CHARACTERS = 2_000_000;
export const MAX_XLSX_ENTRIES = 2_000;
export const MAX_XLSX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_XLSX_ENTRY_BYTES = 20 * 1024 * 1024;
export const MAX_XLSX_COMPRESSION_RATIO = 100;

export type WorkbookErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "INVALID_XLSX"
  | "UNSAFE_ARCHIVE"
  | "TOO_MANY_SHEETS"
  | "TOO_MANY_ROWS"
  | "TOO_MANY_COLUMNS"
  | "CELL_TEXT_TOO_LONG"
  | "HEADER_TEXT_TOO_LONG"
  | "WORKBOOK_TEXT_TOO_LARGE"
  | "INVALID_CSV_ENCODING"
  | "SHEET_NOT_FOUND";

export class WorkbookImportError extends Error {
  constructor(
    readonly code: WorkbookErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WorkbookImportError";
  }
}

export interface WorkbookOptions {
  filename?: string;
  previewRows?: number;
  headerRow?: number;
  maxBytes?: number;
  maxSheets?: number;
  maxRows?: number;
  maxColumns?: number;
  maxCellCharacters?: number;
  maxHeaderCharacters?: number;
  maxTotalCharacters?: number;
}

export interface ConvertedWorkbookRow {
  row_number: number;
  raw_data: Record<string, ExcelCellValue>;
  mapped_data: Record<string, ExcelCellValue>;
  warnings: string[];
}

type WorkbookFormat = "xlsx" | "csv";

interface ParsedCell {
  value: ExcelCellValue;
  warning?: string;
}

/**
 * Returns the number of UTF-16 code units that the normalized cell can expose.
 * Rich-text segments are summed without joining them so validation does not
 * create a second, potentially very large string before rejecting the file.
 */
function logicalCellCharacterCount(value: unknown, ceiling: number): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") return value.length;
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value).length;
  }
  if (value instanceof Date) return 10;
  if (Buffer.isBuffer(value)) return 0;
  if (typeof value !== "object") return String(value).length;

  const record = value as Record<string, unknown>;
  if ("formula" in record || "sharedFormula" in record) {
    return logicalCellCharacterCount(record.result, ceiling);
  }
  if (typeof record.text === "string") return record.text.length;
  if (Array.isArray(record.richText)) {
    let characters = 0;
    for (const item of record.richText) {
      if (!item || typeof item !== "object" || !("text" in item)) continue;
      const text = (item as { text: unknown }).text;
      characters += typeof text === "string" ? text.length : String(text).length;
      if (characters > ceiling) return characters;
    }
    return characters;
  }
  if ("error" in record) return String(record.error).length;
  return 0;
}

function workbookFormat(data: Uint8Array, filename = ""): WorkbookFormat {
  const extension = filename.toLowerCase().split(".").pop();
  if (extension === "xls" || extension === "xlsm") {
    throw new WorkbookImportError(
      "UNSUPPORTED_FORMAT",
      "仅支持 .xlsx 和 .csv，不支持 .xls 或含宏工作簿",
    );
  }
  if (extension === "csv") return "csv";
  if (extension === "xlsx") return "xlsx";
  if (data[0] === 0x50 && data[1] === 0x4b) return "xlsx";
  throw new WorkbookImportError(
    "UNSUPPORTED_FORMAT",
    "仅支持 .xlsx 和 UTF-8 CSV 文件",
  );
}

function isUnsafeArchivePath(filename: string): boolean {
  const normalized = filename.replace(/\\/g, "/");
  return (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split("/").some((part) => part === "..")
  );
}

function openZip(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, autoClose: true, decodeStrings: true },
      (error, zipfile) => {
        if (error || !zipfile) {
          reject(
            new WorkbookImportError(
              "INVALID_XLSX",
              "XLSX ZIP 结构无效",
              error,
            ),
          );
          return;
        }
        resolve(zipfile);
      },
    );
  });
}

export async function preflightXlsxArchive(data: Uint8Array): Promise<void> {
  if (!(data[0] === 0x50 && data[1] === 0x4b)) {
    throw new WorkbookImportError("INVALID_XLSX", "文件没有有效的 ZIP 标识");
  }

  const zipfile = await openZip(Buffer.from(data));
  await new Promise<void>((resolve, reject) => {
    let entries = 0;
    let uncompressedBytes = 0;
    let hasContentTypes = false;
    let hasWorkbook = false;
    let settled = false;

    const fail = (error: WorkbookImportError) => {
      if (settled) return;
      settled = true;
      zipfile.close();
      reject(error);
    };

    zipfile.on("error", (error) =>
      fail(
        new WorkbookImportError(
          "INVALID_XLSX",
          "读取 XLSX ZIP 结构失败",
          error,
        ),
      ),
    );
    zipfile.on("entry", (entry) => {
      if (settled) return;
      entries += 1;
      if (entries > MAX_XLSX_ENTRIES) {
        fail(new WorkbookImportError("UNSAFE_ARCHIVE", "XLSX 文件条目过多"));
        return;
      }
      if (isUnsafeArchivePath(entry.fileName)) {
        fail(
          new WorkbookImportError("UNSAFE_ARCHIVE", "XLSX 包含不安全的文件路径"),
        );
        return;
      }

      if (entry.fileName === "[Content_Types].xml") hasContentTypes = true;
      if (entry.fileName === "xl/workbook.xml") hasWorkbook = true;

      uncompressedBytes += entry.uncompressedSize;
      if (
        entry.uncompressedSize > MAX_XLSX_ENTRY_BYTES ||
        uncompressedBytes > MAX_XLSX_UNCOMPRESSED_BYTES
      ) {
        fail(new WorkbookImportError("UNSAFE_ARCHIVE", "XLSX 解压后内容过大"));
        return;
      }
      if (
        entry.uncompressedSize > 0 &&
        (entry.compressedSize === 0 ||
          entry.uncompressedSize / entry.compressedSize >
            MAX_XLSX_COMPRESSION_RATIO)
      ) {
        fail(new WorkbookImportError("UNSAFE_ARCHIVE", "XLSX 压缩比异常"));
        return;
      }
      zipfile.readEntry();
    });
    zipfile.on("end", () => {
      if (settled) return;
      settled = true;
      if (!hasContentTypes || !hasWorkbook) {
        reject(
          new WorkbookImportError(
            "INVALID_XLSX",
            "ZIP 文件不是有效的 XLSX 工作簿",
          ),
        );
        return;
      }
      resolve();
    });
    zipfile.readEntry();
  });
}

function scalarCellValue(value: unknown): ParsedCell {
  if (value === null || value === undefined || value === "") {
    return { value: null };
  }
  if (typeof value === "string") return { value };
  if (typeof value === "boolean") return { value };
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { value }
      : { value: null, warning: "非有限数值已转为 null" };
  }
  if (value instanceof Date) {
    return { value: value.toISOString().slice(0, 10) };
  }
  if (Buffer.isBuffer(value)) {
    return { value: null, warning: "二进制单元格未导入" };
  }
  if (typeof value !== "object") return { value: String(value) };

  const record = value as Record<string, unknown>;
  if ("formula" in record || "sharedFormula" in record) {
    const parsed = scalarCellValue(record.result);
    return {
      value: parsed.value,
      warning:
        record.result === undefined || record.result === null
          ? "公式单元格没有缓存结果，已转为 null"
          : "公式单元格使用缓存结果，需人工确认",
    };
  }
  if (typeof record.text === "string") {
    return {
      value: record.text,
      warning: "超链接仅保留显示文字，不访问外部链接",
    };
  }
  if (Array.isArray(record.richText)) {
    const text = record.richText
      .map((item) =>
        item && typeof item === "object" && "text" in item
          ? String((item as { text: unknown }).text)
          : "",
      )
      .join("");
    return { value: text || null };
  }
  if ("error" in record) {
    return { value: null, warning: `错误单元格 ${String(record.error)} 已转为 null` };
  }

  return { value: null, warning: "不支持的复杂单元格已转为 null" };
}

function uniqueHeaders(
  worksheet: ExcelJS.Worksheet,
  headerRow: number,
  columnCount: number,
  warnings: string[],
  maxHeaderCharacters: number,
): string[] {
  const counts = new Map<string, number>();
  const headers: string[] = [];
  const row = worksheet.getRow(headerRow);

  for (let column = 1; column <= columnCount; column += 1) {
    const parsed = scalarCellValue(row.getCell(column).value);
    const base =
      parsed.value === null || String(parsed.value).trim() === ""
        ? `Column ${column}`
        : String(parsed.value).trim();
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    const header = count === 1 ? base : `${base} (${count})`;
    if (header.length > maxHeaderCharacters) {
      throw new WorkbookImportError(
        "HEADER_TEXT_TOO_LONG",
        `工作表“${worksheet.name}”第 ${column} 列表头超过 ${maxHeaderCharacters} 个字符限制`,
      );
    }
    if (count > 1) warnings.push(`重复表头“${base}”已重命名为“${header}”`);
    if (parsed.warning) warnings.push(`表头第 ${column} 列：${parsed.warning}`);
    headers.push(header);
  }
  return headers;
}

function readRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
): { values: ExcelCellValue[]; warnings: string[] } {
  const values: ExcelCellValue[] = [];
  const warnings: string[] = [];
  const row = worksheet.getRow(rowNumber);
  for (let column = 1; column <= columnCount; column += 1) {
    const parsed = scalarCellValue(row.getCell(column).value);
    values.push(parsed.value);
    if (parsed.warning) warnings.push(`第 ${column} 列：${parsed.warning}`);
  }
  return { values, warnings };
}

async function loadWorkbook(
  input: Uint8Array,
  options: WorkbookOptions,
): Promise<{ workbook: ExcelJS.Workbook; format: WorkbookFormat }> {
  const maxBytes = options.maxBytes ?? MAX_WORKBOOK_BYTES;
  if (input.byteLength === 0) {
    throw new WorkbookImportError("EMPTY_FILE", "工作簿文件为空");
  }
  if (input.byteLength > maxBytes) {
    throw new WorkbookImportError(
      "FILE_TOO_LARGE",
      `工作簿超过 ${maxBytes} 字节限制`,
    );
  }

  const format = workbookFormat(input, options.filename);
  const workbook = new ExcelJS.Workbook();
  try {
    if (format === "xlsx") {
      await preflightXlsxArchive(input);
      await workbook.xlsx.load(Uint8Array.from(input).buffer);
    } else {
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(input);
      } catch (error) {
        throw new WorkbookImportError(
          "INVALID_CSV_ENCODING",
          "CSV 必须使用 UTF-8 编码",
          error,
        );
      }
      await workbook.csv.read(Readable.from([text]), { sheetName: "Sheet1" });
    }
  } catch (error) {
    if (error instanceof WorkbookImportError) throw error;
    throw new WorkbookImportError(
      format === "xlsx" ? "INVALID_XLSX" : "UNSUPPORTED_FORMAT",
      "无法读取工作簿",
      error,
    );
  }
  return { workbook, format };
}

function assertWorkbookLimits(
  workbook: ExcelJS.Workbook,
  options: WorkbookOptions,
): number {
  const maxSheets = options.maxSheets ?? MAX_WORKBOOK_SHEETS;
  const maxRows = options.maxRows ?? MAX_WORKBOOK_ROWS;
  const maxColumns = options.maxColumns ?? MAX_WORKBOOK_COLUMNS;
  const maxCellCharacters =
    options.maxCellCharacters ?? MAX_WORKBOOK_CELL_CHARACTERS;
  const maxHeaderCharacters =
    options.maxHeaderCharacters ?? MAX_WORKBOOK_HEADER_CHARACTERS;
  const maxTotalCharacters =
    options.maxTotalCharacters ?? MAX_WORKBOOK_LOGICAL_CHARACTERS;
  const headerRow = options.headerRow ?? 1;
  let totalCharacters = 0;
  if (workbook.worksheets.length > maxSheets) {
    throw new WorkbookImportError(
      "TOO_MANY_SHEETS",
      `工作表数量超过 ${maxSheets} 个限制`,
    );
  }
  for (const worksheet of workbook.worksheets) {
    if (worksheet.actualRowCount > maxRows + 1) {
      throw new WorkbookImportError(
        "TOO_MANY_ROWS",
        `工作表“${worksheet.name}”超过 ${maxRows} 行限制`,
      );
    }
    if (worksheet.actualColumnCount > maxColumns) {
      throw new WorkbookImportError(
        "TOO_MANY_COLUMNS",
        `工作表“${worksheet.name}”超过 ${maxColumns} 列限制`,
      );
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        const characters = logicalCellCharacterCount(
          cell.value,
          Math.min(maxCellCharacters, maxTotalCharacters - totalCharacters),
        );
        if (rowNumber === headerRow && characters > maxHeaderCharacters) {
          throw new WorkbookImportError(
            "HEADER_TEXT_TOO_LONG",
            `工作表“${worksheet.name}”第 ${columnNumber} 列表头超过 ${maxHeaderCharacters} 个字符限制`,
          );
        }
        if (characters > maxCellCharacters) {
          throw new WorkbookImportError(
            "CELL_TEXT_TOO_LONG",
            `工作表“${worksheet.name}”第 ${rowNumber} 行第 ${columnNumber} 列内容超过 ${maxCellCharacters} 个字符限制`,
          );
        }
        totalCharacters += characters;
        if (totalCharacters > maxTotalCharacters) {
          throw new WorkbookImportError(
            "WORKBOOK_TEXT_TOO_LARGE",
            `工作簿单元格文本总量超过 ${maxTotalCharacters} 个字符限制`,
          );
        }
      });
    });
  }
  return totalCharacters;
}

export async function inspectWorkbook(
  input: Uint8Array,
  options: WorkbookOptions = {},
): Promise<ExcelWorkbookPreview> {
  const { workbook } = await loadWorkbook(input, options);
  assertWorkbookLimits(workbook, options);
  const headerRow = options.headerRow ?? 1;
  const maxHeaderCharacters =
    options.maxHeaderCharacters ?? MAX_WORKBOOK_HEADER_CHARACTERS;
  const previewRows = Math.min(options.previewRows ?? 20, 20);
  const warnings: string[] = [];
  const sheets: ExcelSheetPreview[] = workbook.worksheets.map((worksheet) => {
    const columnCount = worksheet.actualColumnCount;
    const headers = uniqueHeaders(
      worksheet,
      headerRow,
      columnCount,
      warnings,
      maxHeaderCharacters,
    );
    const rows: ExcelPreviewRow[] = [];

    for (
      let rowNumber = headerRow + 1;
      rowNumber <= worksheet.actualRowCount && rows.length < previewRows;
      rowNumber += 1
    ) {
      const row = readRow(worksheet, rowNumber, columnCount);
      if (row.values.every((value) => value === null)) continue;
      rows.push({ row_number: rowNumber, ...row });
    }

    const state = worksheet.state ?? "visible";
    if (state !== "visible") {
      warnings.push(`工作表“${worksheet.name}”为 ${state}，默认不应自动导入`);
    }
    return {
      name: worksheet.name,
      state,
      row_count: Math.max(worksheet.actualRowCount - headerRow, 0),
      column_count: columnCount,
      headers,
      rows,
    };
  });

  return { sheets, warnings };
}

export async function convertWorkbookRows(
  input: Uint8Array,
  sheetName: string,
  mapping: ExcelMapping,
  options: WorkbookOptions = {},
): Promise<ConvertedWorkbookRow[]> {
  const { workbook } = await loadWorkbook(input, options);
  const totalCharacters = assertWorkbookLimits(workbook, options);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new WorkbookImportError(
      "SHEET_NOT_FOUND",
      `找不到工作表“${sheetName}”`,
    );
  }

  const headerRow = options.headerRow ?? 1;
  const maxHeaderCharacters =
    options.maxHeaderCharacters ?? MAX_WORKBOOK_HEADER_CHARACTERS;
  const warnings: string[] = [];
  const columnCount = worksheet.actualColumnCount;
  const headers = uniqueHeaders(
    worksheet,
    headerRow,
    columnCount,
    warnings,
    maxHeaderCharacters,
  );
  const maxTotalCharacters =
    options.maxTotalCharacters ?? MAX_WORKBOOK_LOGICAL_CHARACTERS;
  const dataRowCount = Math.max(worksheet.actualRowCount - headerRow, 0);
  const repeatedRawDataKeyCharacters =
    headers.reduce((total, header) => total + header.length, 0) * dataRowCount;
  if (totalCharacters + repeatedRawDataKeyCharacters > maxTotalCharacters) {
    throw new WorkbookImportError(
      "WORKBOOK_TEXT_TOO_LARGE",
      `工作簿转换后的文本总量预计超过 ${maxTotalCharacters} 个字符限制；表头会作为每行字段名重复`,
    );
  }
  const headerIndexes = new Map(
    headers.map((header, index) => [header, index] as const),
  );
  const converted: ConvertedWorkbookRow[] = [];

  for (
    let rowNumber = headerRow + 1;
    rowNumber <= worksheet.actualRowCount;
    rowNumber += 1
  ) {
    const row = readRow(worksheet, rowNumber, columnCount);
    if (row.values.every((value) => value === null)) continue;
    const rawData = Object.fromEntries(
      headers.map((header, index) => [header, row.values[index] ?? null]),
    );
    const mappedData: Record<string, ExcelCellValue> = {};
    const rowWarnings = [...row.warnings];

    for (const [targetField, sourceHeader] of Object.entries(mapping)) {
      if (sourceHeader === null) {
        mappedData[targetField] = null;
        continue;
      }
      const sourceIndex = headerIndexes.get(sourceHeader);
      if (sourceIndex === undefined) {
        mappedData[targetField] = null;
        rowWarnings.push(`映射列“${sourceHeader}”不存在`);
        continue;
      }
      mappedData[targetField] = row.values[sourceIndex] ?? null;
    }

    converted.push({
      row_number: rowNumber,
      raw_data: rawData,
      mapped_data: mappedData,
      warnings: rowWarnings,
    });
  }

  return converted;
}
