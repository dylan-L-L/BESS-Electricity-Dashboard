import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  convertWorkbookRows,
  inspectWorkbook,
  MAX_WORKBOOK_CELL_CHARACTERS,
  MAX_WORKBOOK_HEADER_CHARACTERS,
} from "../../src/lib/imports/workbook";

async function workbookBytes(
  rows: Array<Array<string | number | boolean | null>>,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  rows.forEach((row) => worksheet.addRow(row));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

async function exampleXlsx(): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const metrics = workbook.addWorksheet("Metrics");
  metrics.addRow(["地区", "数值", "单位", "公式"]);
  metrics.addRow(["山东", 0, null]);
  metrics.getCell("D2").value = { formula: "1+2", result: 3 };
  metrics.addRow(["广东", null, "CNY/kWh", false]);

  const hidden = workbook.addWorksheet("Hidden");
  hidden.state = "hidden";
  hidden.addRow(["地区", "数值"]);
  hidden.addRow(["测试", 1]);

  const output = await workbook.xlsx.writeBuffer();
  return new Uint8Array(output);
}

describe("workbook import", () => {
  it("previews XLSX sheets, preserves null and zero, and warns on formulas", async () => {
    const input = await exampleXlsx();
    const preview = await inspectWorkbook(input, { filename: "demo.xlsx" });

    expect(preview.sheets).toHaveLength(2);
    expect(preview.sheets[0]).toMatchObject({
      name: "Metrics",
      state: "visible",
      headers: ["地区", "数值", "单位", "公式"],
    });
    expect(preview.sheets[0].rows[0].values).toEqual(["山东", 0, null, 3]);
    expect(preview.sheets[0].rows[0].warnings.join("\n")).toContain(
      "公式单元格使用缓存结果",
    );
    expect(preview.sheets[1].state).toBe("hidden");
    expect(preview.warnings.join("\n")).toContain("工作表“Hidden”为 hidden");
  });

  it("converts selected rows deterministically with explicit missing mappings", async () => {
    const input = await exampleXlsx();
    const rows = await convertWorkbookRows(
      input,
      "Metrics",
      {
        region: "地区",
        value: "数值",
        unit: "单位",
        computed: "公式",
        ignored: null,
        missing: "不存在",
      },
      { filename: "demo.xlsx" },
    );

    expect(rows[0]).toMatchObject({
      row_number: 2,
      raw_data: { 地区: "山东", 数值: 0, 单位: null, 公式: 3 },
      mapped_data: {
        region: "山东",
        value: 0,
        unit: null,
        computed: 3,
        ignored: null,
        missing: null,
      },
    });
    expect(rows[0].warnings.join("\n")).toContain("映射列“不存在”不存在");
    expect(rows[1].mapped_data.value).toBeNull();
    expect(rows[1].mapped_data.computed).toBe(false);
  });

  it("reads UTF-8 CSV and keeps blank cells distinct from zero", async () => {
    const input = Buffer.from(
      "地区,数值,单位\n山东,0,\n广东,,CNY/kWh\n",
      "utf8",
    );
    const preview = await inspectWorkbook(input, { filename: "demo.csv" });

    expect(preview.sheets[0].rows.map((row) => row.values)).toEqual([
      ["山东", 0, null],
      ["广东", null, "CNY/kWh"],
    ]);
  });

  it("rejects unsupported legacy and macro-enabled workbooks", async () => {
    await expect(
      inspectWorkbook(Buffer.from("legacy"), { filename: "demo.xls" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(
      inspectWorkbook(Buffer.from("macro"), { filename: "demo.xlsm" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("rejects an oversized cell before preview or conversion can expand it", async () => {
    const input = Buffer.from(
      `地区,说明\n山东,正常\n广东,${"x".repeat(MAX_WORKBOOK_CELL_CHARACTERS + 1)}\n`,
      "utf8",
    );

    await expect(
      inspectWorkbook(input, { filename: "large-cell.csv", previewRows: 1 }),
    ).rejects.toMatchObject({
      code: "CELL_TEXT_TOO_LONG",
      message: expect.stringContaining("第 3 行第 2 列"),
    });
    await expect(
      convertWorkbookRows(
        input,
        "Sheet1",
        { region: "地区", summary: "说明" },
        { filename: "large-cell.csv" },
      ),
    ).rejects.toMatchObject({ code: "CELL_TEXT_TOO_LONG" });
  });

  it("rejects a header that exceeds the header character limit", async () => {
    const input = await workbookBytes([
      ["h".repeat(MAX_WORKBOOK_HEADER_CHARACTERS + 1)],
      ["value"],
    ]);

    await expect(
      inspectWorkbook(input, { filename: "large-header.xlsx" }),
    ).rejects.toMatchObject({
      code: "HEADER_TEXT_TOO_LONG",
      message: expect.stringContaining("表头超过 200 个字符限制"),
    });
  });

  it("rejects a workbook whose combined logical text exceeds its budget", async () => {
    const input = await workbookBytes([
      ["列一", "列二"],
      ["12345", "67890"],
      ["abcde", "fghij"],
    ]);
    const sourceBudgetOptions = {
      filename: "logical-budget.xlsx",
      maxTotalCharacters: 15,
    };

    await expect(inspectWorkbook(input, sourceBudgetOptions)).rejects.toMatchObject({
      code: "WORKBOOK_TEXT_TOO_LARGE",
      message: expect.stringContaining("文本总量超过 15 个字符限制"),
    });

    const conversionBudgetOptions = {
      filename: "logical-budget.xlsx",
      maxTotalCharacters: 30,
    };
    await expect(inspectWorkbook(input, conversionBudgetOptions)).resolves.toBeDefined();
    await expect(
      convertWorkbookRows(
        input,
        "Sheet1",
        { first: "列一" },
        conversionBudgetOptions,
      ),
    ).rejects.toMatchObject({
      code: "WORKBOOK_TEXT_TOO_LARGE",
      message: expect.stringContaining("表头会作为每行字段名重复"),
    });
  });
});
