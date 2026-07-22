import type {
  ExcelWorkbookPreview,
  ImportItem,
  ImportJob,
} from "@/lib/imports/types";

type UnknownRecord = Record<string, unknown>;

export type ImportJobView = {
  raw: ImportJob;
  id: string;
  inputType: "url" | "pdf" | "excel" | string;
  inputName: string;
  sourceUrl: string | null;
  originalFilename: string | null;
  fileHash: string | null;
  status: string;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  errorMessage: string | null;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type EvidenceView = {
  field: string | null;
  location: string | null;
  page: number | null;
  sheet: string | null;
  row: number | null;
  quote: string | null;
};

export type ImportItemView = {
  raw: ImportItem;
  id: string;
  jobId: string;
  targetType: "signal" | "market_metric" | "unknown" | string;
  sourceLocation: string | null;
  extractedText: string | null;
  rawData: unknown;
  draftData: Record<string, unknown>;
  evidence: EvidenceView[];
  confidence: number | null;
  warnings: string[];
  errorCode: string | null;
  errorMessage: string | null;
  reviewStatus: string;
  reviewerNote: string;
  approvedRecordId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ExcelSheetView = {
  name: string;
  hidden: boolean;
  headers: string[];
  rows: unknown[][];
  rowNumbers: number[];
};

export type ExcelWorkbookView = {
  raw: ExcelWorkbookPreview;
  sheets: ExcelSheetView[];
};

export type ReviewSourceView = {
  text: string | null;
  sourceUrl: string | null;
  signedUrl: string | null;
  sourceLocation: unknown;
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function booleanValue(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function firstString(source: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = stringValue(source[key]);
    if (value) return value;
  }
  return null;
}

function firstNumber(source: UnknownRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = numberValue(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function toImportJobView(job: ImportJob): ImportJobView {
  const source = record(job);
  const inputType = firstString(source, "input_type", "inputType") ?? "unknown";
  const originalFilename = firstString(source, "original_filename", "originalFilename");
  const sourceUrl = firstString(source, "canonical_url", "canonicalUrl", "source_url", "sourceUrl");
  const inputName =
    firstString(source, "input_name", "inputName") ??
    originalFilename ??
    sourceUrl ??
    "未命名导入";

  return {
    raw: job,
    id: firstString(source, "id") ?? "",
    inputType,
    inputName,
    sourceUrl,
    originalFilename,
    fileHash: firstString(source, "file_hash", "fileHash"),
    status: firstString(source, "status") ?? "pending",
    totalItems: firstNumber(source, "total_items", "totalItems") ?? 0,
    successfulItems: firstNumber(source, "successful_items", "successfulItems") ?? 0,
    failedItems: firstNumber(source, "failed_items", "failedItems") ?? 0,
    errorMessage: firstString(source, "error_message", "errorMessage"),
    createdAt: firstString(source, "created_at", "createdAt"),
    startedAt: firstString(source, "started_at", "startedAt"),
    completedAt: firstString(source, "completed_at", "completedAt"),
  };
}

function normalizeEvidence(value: unknown): EvidenceView[] {
  return arrayValue(value).map((entry) => {
    const source = record(entry);
    return {
      field: firstString(source, "field"),
      location: firstString(source, "location", "source_location"),
      page: firstNumber(source, "page"),
      sheet: firstString(source, "sheet", "sheet_name"),
      row: firstNumber(source, "row", "row_number"),
      quote: firstString(source, "quote", "text"),
    };
  });
}

function normalizeWarnings(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return arrayValue(value)
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      return firstString(record(entry), "message", "warning") ?? "";
    })
    .filter(Boolean);
}

function normalizeDraftData(source: UnknownRecord): Record<string, unknown> {
  const direct = record(source.draft_data ?? source.draftData);
  if (Object.keys(direct).length) return direct;

  const ai = record(source.ai_result ?? source.aiResult);
  const nested = record(ai.data ?? ai.output ?? ai.result);
  return Object.keys(nested).length ? nested : ai;
}

export function toImportItemView(item: ImportItem): ImportItemView {
  const source = record(item);
  const ai = record(source.ai_result ?? source.aiResult);
  const evidence = source.evidence ?? ai.evidence;
  const warnings = source.warnings ?? ai.warnings;

  return {
    raw: item,
    id: firstString(source, "id") ?? "",
    jobId: firstString(source, "import_job_id", "importJobId") ?? "",
    targetType: firstString(source, "target_type", "targetType") ?? "unknown",
    sourceLocation:
      firstString(source, "source_location", "sourceLocation") ??
      firstString(record(source.source_location ?? source.sourceLocation), "location") ??
      (firstString(source, "sheet_name", "sheetName")
        ? `${firstString(source, "sheet_name", "sheetName")}${firstNumber(source, "source_row_number", "sourceRowNumber") ? ` · 第 ${firstNumber(source, "source_row_number", "sourceRowNumber")} 行` : ""}`
        : null),
    extractedText: firstString(source, "extracted_text", "extractedText"),
    rawData: source.raw_data ?? source.rawData ?? null,
    draftData: normalizeDraftData(source),
    evidence: normalizeEvidence(evidence),
    confidence: firstNumber(source, "confidence") ?? firstNumber(ai, "confidence"),
    warnings: normalizeWarnings(warnings),
    errorCode: firstString(source, "error_code", "errorCode"),
    errorMessage: firstString(source, "error_message", "errorMessage"),
    reviewStatus: firstString(source, "review_status", "reviewStatus") ?? "ai_draft",
    reviewerNote: firstString(source, "reviewer_note", "reviewerNote") ?? "",
    approvedRecordId: firstString(source, "approved_record_id", "approvedRecordId"),
    createdAt: firstString(source, "created_at", "createdAt"),
    updatedAt: firstString(source, "updated_at", "updatedAt"),
  };
}

function normalizeSheet(sheet: unknown, fallbackName: string): ExcelSheetView {
  const source = record(sheet);
  const name = firstString(source, "name", "sheet_name", "sheetName") ?? fallbackName;
  const rawRows = arrayValue(source.rows ?? source.preview_rows ?? source.previewRows).slice(0, 20);
  let headers = arrayValue(source.headers ?? source.columns)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (!headers.length) {
    const firstObjectRow = rawRows.find(
      (row) => row && typeof row === "object" && !Array.isArray(row),
    );
    if (firstObjectRow) headers = Object.keys(record(firstObjectRow));
  }

  if (!headers.length) {
    const widestRow = rawRows.reduce<number>(
      (largest, row) => Math.max(largest, Array.isArray(row) ? row.length : 0),
      0,
    );
    headers = Array.from({ length: widestRow }, (_, index) => `列 ${index + 1}`);
  }

  const rows = rawRows.map((row) => {
    if (Array.isArray(row)) return headers.map((_, index) => row[index] ?? null);
    const rowRecord = record(row);
    const values = arrayValue(rowRecord.values);
    if (values.length) return headers.map((_, index) => values[index] ?? null);
    return headers.map((header) => rowRecord[header] ?? null);
  });
  const rowNumbers = rawRows.map((row, index) => firstNumber(record(row), "row_number", "rowNumber") ?? index + 2);

  const state = firstString(source, "state", "visibility")?.toLowerCase();
  return {
    name,
    hidden:
      booleanValue(source.hidden ?? source.is_hidden ?? source.isHidden) ||
      state === "hidden" ||
      state === "veryhidden",
    headers,
    rows,
    rowNumbers,
  };
}

export function toExcelWorkbookView(preview: ExcelWorkbookPreview): ExcelWorkbookView {
  const source = record(preview);
  const candidates = arrayValue(source.sheets ?? source.worksheets ?? source.sheet_previews);
  return {
    raw: preview,
    sheets: candidates.map((sheet, index) => normalizeSheet(sheet, `Sheet ${index + 1}`)),
  };
}

function nestedData(value: unknown): UnknownRecord {
  const source = record(value);
  return Object.keys(record(source.data)).length ? record(source.data) : source;
}

export function readImportJobsResult(value: unknown): ImportJob[] {
  if (Array.isArray(value)) return value as ImportJob[];
  const source = nestedData(value);
  const jobs = source.jobs ?? source.import_jobs ?? source.importJobs ?? source.data;
  return arrayValue(jobs) as ImportJob[];
}

export function readImportJobResult(value: unknown): {
  job: ImportJob | null;
  items: ImportItem[];
  workbookPreview: ExcelWorkbookPreview | null;
} {
  const source = nestedData(value);
  return {
    job: (source.job ?? source.import_job ?? source.importJob ?? null) as ImportJob | null,
    items: arrayValue(source.items ?? source.import_items ?? source.importItems) as ImportItem[],
    workbookPreview: (source.workbookPreview ??
      source.workbook_preview ??
      source.excel_preview ??
      null) as ExcelWorkbookPreview | null,
  };
}

export function readImportReviewResult(value: unknown): {
  job: ImportJob | null;
  item: ImportItem | null;
  items: ImportItem[];
  regions: unknown[];
  sourcePreview: ReviewSourceView | null;
} {
  const source = nestedData(value);
  const preview = record(source.sourcePreview ?? source.source_preview);
  return {
    job: (source.job ?? source.import_job ?? source.importJob ?? null) as ImportJob | null,
    item: (source.item ?? source.import_item ?? source.importItem ?? null) as ImportItem | null,
    items: arrayValue(source.items ?? source.import_items ?? source.importItems) as ImportItem[],
    regions: arrayValue(source.regions),
    sourcePreview: Object.keys(preview).length
      ? {
          text: firstString(preview, "text", "extracted_text"),
          sourceUrl: firstString(preview, "source_url", "sourceUrl"),
          signedUrl: firstString(preview, "signed_url", "signedUrl"),
          sourceLocation: preview.source_location ?? preview.sourceLocation ?? null,
        }
      : null,
  };
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN");
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
