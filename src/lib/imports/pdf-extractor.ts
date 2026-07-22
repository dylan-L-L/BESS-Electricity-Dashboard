import type { ImportEvidence } from "@/lib/imports/types";

type PdfLoadingTask = ReturnType<
  typeof import("pdfjs-dist/legacy/build/pdf.mjs")["getDocument"]
>;
type PdfDocument = Awaited<PdfLoadingTask["promise"]>;

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 100;
export const MAX_PDF_TEXT_CHARS = 300_000;

export type PdfExtractionErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_PDF"
  | "ENCRYPTED_PDF"
  | "TOO_MANY_PAGES"
  | "TEXT_TOO_LARGE"
  | "PARSE_TIMEOUT"
  | "PARSE_FAILED";

export class PdfExtractionError extends Error {
  constructor(
    readonly code: PdfExtractionErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

export interface PdfPageText {
  page: number;
  text: string;
}

export interface PdfExtractionResult {
  pageCount: number;
  pages: PdfPageText[];
  text: string;
  likelyScanned: boolean;
  warnings: string[];
}

export interface PdfExtractorOptions {
  maxBytes?: number;
  maxPages?: number;
  maxTextChars?: number;
  timeoutMs?: number;
}

function hasPdfMagic(data: Uint8Array): boolean {
  if (data.byteLength === 0) return false;
  const prefix = Buffer.from(data.subarray(0, Math.min(data.byteLength, 1024)));
  return prefix.indexOf("%PDF-") >= 0;
}

function normalizePageText(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t\f\v\u00a0 ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function appendTextToken(current: string, rawToken: string): string {
  const token = rawToken.replace(/[\t\f\v\u00a0 ]+/g, " ").trim();
  if (!token) return current;
  const needsSpace =
    /[A-Za-z0-9]$/.test(current) && /^[A-Za-z0-9]/.test(token);
  return `${current}${needsSpace ? " " : ""}${token}`;
}

export function isLikelyScannedPdf(pages: readonly PdfPageText[]): boolean {
  if (pages.length === 0) return true;
  const nonWhitespaceCharacters = pages.reduce(
    (total, page) => total + page.text.replace(/\s/g, "").length,
    0,
  );
  const pagesWithUsefulText = pages.filter(
    (page) => page.text.replace(/\s/g, "").length >= 20,
  ).length;

  return (
    nonWhitespaceCharacters < 40 ||
    pagesWithUsefulText / pages.length < 0.2
  );
}

function normalizedEvidenceText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "");
}

export function validatePdfEvidence(
  pages: readonly PdfPageText[],
  evidence: Pick<ImportEvidence, "page" | "quote">,
): boolean {
  if (!evidence.page || !evidence.quote.trim()) return false;
  const page = pages.find((item) => item.page === evidence.page);
  if (!page) return false;
  return normalizedEvidenceText(page.text).includes(
    normalizedEvidenceText(evidence.quote),
  );
}

function timeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new PdfExtractionError(
          "PARSE_TIMEOUT",
          `PDF 解析超过 ${timeoutMs} 毫秒`,
        ),
      );
    }, timeoutMs);
    timeout.unref?.();
  });
}

export async function extractPdfText(
  input: Uint8Array,
  options: PdfExtractorOptions = {},
): Promise<PdfExtractionResult> {
  const maxBytes = options.maxBytes ?? MAX_PDF_BYTES;
  const maxPages = options.maxPages ?? MAX_PDF_PAGES;
  const maxTextChars = options.maxTextChars ?? MAX_PDF_TEXT_CHARS;
  const timeoutMs = options.timeoutMs ?? 120_000;

  if (input.byteLength === 0) {
    throw new PdfExtractionError("EMPTY_FILE", "PDF 文件为空");
  }
  if (input.byteLength > maxBytes) {
    throw new PdfExtractionError(
      "FILE_TOO_LARGE",
      `PDF 文件超过 ${maxBytes} 字节限制`,
    );
  }
  if (!hasPdfMagic(input)) {
    throw new PdfExtractionError("INVALID_PDF", "文件没有有效的 PDF 标识");
  }

  let loadingTask: PdfLoadingTask | undefined;
  let document: PdfDocument | undefined;

  const parse = async (): Promise<PdfExtractionResult> => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    loadingTask = pdfjs.getDocument({
      // Clone because PDF.js may transfer ownership to its worker.
      data: new Uint8Array(input),
      isEvalSupported: false,
      useWorkerFetch: false,
      disableAutoFetch: true,
      disableStream: true,
      stopAtErrors: true,
      enableXfa: false,
    });
    document = await loadingTask.promise;

    if (document.numPages > maxPages) {
      throw new PdfExtractionError(
        "TOO_MANY_PAGES",
        `PDF 页数超过 ${maxPages} 页限制`,
      );
    }

    const pages: PdfPageText[] = [];
    let totalCharacters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });
        const lines: string[] = [];
        let currentLine = "";

        for (const item of content.items) {
          if (!("str" in item)) continue;
          currentLine = appendTextToken(currentLine, item.str);
          if (item.hasEOL && currentLine) {
            lines.push(currentLine);
            currentLine = "";
          }
        }
        if (currentLine) lines.push(currentLine);
        const text = normalizePageText(lines.join("\n"));
        totalCharacters += text.length;
        if (totalCharacters > maxTextChars) {
          throw new PdfExtractionError(
            "TEXT_TOO_LARGE",
            `PDF 提取文字超过 ${maxTextChars} 字符限制`,
          );
        }
        pages.push({ page: pageNumber, text });
      } finally {
        page.cleanup();
      }
    }

    const likelyScanned = isLikelyScannedPdf(pages);
    return {
      pageCount: document.numPages,
      pages,
      text: pages
        .map(({ page, text }) => `--- PAGE ${page} ---\n${text}`)
        .join("\n\n"),
      likelyScanned,
      warnings: likelyScanned
        ? ["当前 PDF 可能为扫描件，暂不支持 OCR"]
        : [],
    };
  };

  try {
    return await Promise.race([parse(), timeoutPromise(timeoutMs)]);
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error;
    const name =
      error && typeof error === "object" && "name" in error
        ? String(error.name)
        : "";
    if (name === "PasswordException") {
      throw new PdfExtractionError(
        "ENCRYPTED_PDF",
        "暂不支持加密或需要密码的 PDF",
        error,
      );
    }
    if (name === "InvalidPDFException") {
      throw new PdfExtractionError("INVALID_PDF", "PDF 文件损坏或无效", error);
    }
    throw new PdfExtractionError("PARSE_FAILED", "PDF 解析失败", error);
  } finally {
    if (document) {
      await document.cleanup().catch(() => undefined);
      await document.destroy().catch(() => undefined);
    } else if (loadingTask) {
      await loadingTask.destroy().catch(() => undefined);
    }
  }
}
