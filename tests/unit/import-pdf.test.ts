import { describe, expect, it } from "vitest";

import {
  MAX_PDF_BYTES,
  extractPdfText,
  isLikelyScannedPdf,
  validatePdfEvidence,
} from "../../src/lib/imports/pdf-extractor";

describe("PDF import extraction", () => {
  it("rejects empty, oversized and non-PDF input before parsing", async () => {
    await expect(extractPdfText(new Uint8Array())).rejects.toMatchObject({
      code: "EMPTY_FILE",
    });
    await expect(
      extractPdfText(new Uint8Array(MAX_PDF_BYTES + 1)),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    await expect(
      extractPdfText(Buffer.from("not a PDF")),
    ).rejects.toMatchObject({ code: "INVALID_PDF" });
  });

  it("detects likely scanned documents without running OCR", () => {
    expect(
      isLikelyScannedPdf([
        { page: 1, text: "" },
        { page: 2, text: "短文" },
      ]),
    ).toBe(true);
    expect(
      isLikelyScannedPdf([
        {
          page: 1,
          text: "山东省电力市场交易规则正文，包含足够多的可提取文字内容。本页还列明了交易品种、结算周期、价格单位和考核机制，供管理员核验。",
        },
      ]),
    ).toBe(false);
  });

  it("validates evidence against the exact PDF page", () => {
    const pages = [
      { page: 1, text: "容量电价 100 元 / kW·年" },
      { page: 2, text: "考核机制详见附件" },
    ];

    expect(
      validatePdfEvidence(pages, {
        page: 1,
        quote: "容量电价100元/kW·年",
      }),
    ).toBe(true);
    expect(
      validatePdfEvidence(pages, {
        page: 2,
        quote: "容量电价100元/kW·年",
      }),
    ).toBe(false);
    expect(
      validatePdfEvidence(pages, { page: null, quote: "容量电价" }),
    ).toBe(false);
  });
});
