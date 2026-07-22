import { describe, expect, it } from "vitest";

import {
  excelRowIdentityKey,
  normalizedExcelRowHash,
} from "@/lib/imports/excel-row-dedupe";

describe("Excel row deduplication identity", () => {
  it("is stable across incidental object key ordering", () => {
    const first = normalizedExcelRowHash({
      title: "山东现货规则",
      value: 0,
      note: null,
    });
    const reordered = normalizedExcelRowHash({
      note: null,
      value: 0,
      title: "山东现货规则",
    });

    expect(first).toBe(reordered);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("preserves null, zero and meaningful string whitespace as distinct rows", () => {
    expect(normalizedExcelRowHash({ value: null })).not.toBe(
      normalizedExcelRowHash({ value: 0 }),
    );
    expect(normalizedExcelRowHash({ label: "容量电价" })).not.toBe(
      normalizedExcelRowHash({ label: "容量电价 " }),
    );
  });

  it("includes source row position in the in-memory identity", () => {
    const rawRowHash = normalizedExcelRowHash({ value: 1 });
    expect(
      excelRowIdentityKey({ sourceRowNumber: 2, rawRowHash }),
    ).not.toBe(excelRowIdentityKey({ sourceRowNumber: 3, rawRowHash }));
  });
});
