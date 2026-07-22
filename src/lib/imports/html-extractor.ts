import * as cheerio from "cheerio";

const BODY_CANDIDATES = [
  "article",
  "main",
  "[role='main']",
  ".article-content",
  ".article",
  ".entry-content",
  ".post-content",
  "#content",
  ".content",
];

const REMOVED_ELEMENTS = [
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "form",
  "iframe",
  "svg",
  "canvas",
  "aside",
].join(",");

export interface HtmlPdfAttachment {
  url: string;
  label: string;
}

export interface HtmlExtraction {
  title: string | null;
  publishedAt: string | null;
  canonicalUrl: string | null;
  sourceName: string | null;
  text: string;
  jsonLd: unknown[];
  pdfAttachments: HtmlPdfAttachment[];
  warnings: string[];
}

export interface HtmlExtractorOptions {
  maxTextChars?: number;
  maxJsonLdScripts?: number;
  maxJsonLdChars?: number;
  maxAttachments?: number;
}

function normalizeInlineText(value: string): string {
  return value.replace(/[\t\f\v\u00a0 ]+/g, " ").trim();
}

function normalizeDocumentText(value: string): string {
  return value
    .split(/\r?\n/)
    .map(normalizeInlineText)
    .filter(Boolean)
    .filter((line, index, lines) => index === 0 || line !== lines[index - 1])
    .join("\n")
    .trim();
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const normalized = value ? normalizeInlineText(value) : "";
    if (normalized) return normalized;
  }
  return null;
}

function absoluteHttpUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function collectReadableText(
  $: cheerio.CheerioAPI,
  selector: string,
): string {
  const root = $(selector).first();
  const lines: string[] = [];

  root.find("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table tr").each((_, node) => {
    const element = $(node);
    const text = element.is("tr")
      ? element
          .find("th,td")
          .map((_index, cell) => normalizeInlineText($(cell).text()))
          .get()
          .filter(Boolean)
          .join(" | ")
      : normalizeInlineText(element.text());
    if (text) lines.push(text);
  });

  if (lines.length === 0) return normalizeDocumentText(root.text());
  return normalizeDocumentText(lines.join("\n"));
}

function findJsonLdDate(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonLdDate(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.datePublished === "string") {
    return normalizeInlineText(record.datePublished) || null;
  }
  for (const child of Object.values(record)) {
    const found = findJsonLdDate(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function loadHtml(input: string | Uint8Array): cheerio.CheerioAPI {
  return typeof input === "string"
    ? cheerio.load(input)
    : cheerio.loadBuffer(Buffer.from(input));
}

export function extractHtmlDocument(
  input: string | Uint8Array,
  pageUrl: string,
  options: HtmlExtractorOptions = {},
): HtmlExtraction {
  const maxTextChars = options.maxTextChars ?? 120_000;
  const maxJsonLdScripts = options.maxJsonLdScripts ?? 20;
  const maxJsonLdChars = options.maxJsonLdChars ?? 100_000;
  const maxAttachments = options.maxAttachments ?? 20;
  const warnings: string[] = [];
  const $ = loadHtml(input);

  const jsonLd: unknown[] = [];
  $("script[type='application/ld+json']")
    .slice(0, maxJsonLdScripts)
    .each((_, node) => {
      const raw = $(node).text().trim();
      if (!raw) return;
      if (raw.length > maxJsonLdChars) {
        warnings.push("JSON-LD 内容过长，已跳过");
        return;
      }
      try {
        jsonLd.push(JSON.parse(raw));
      } catch {
        warnings.push("存在无法解析的 JSON-LD，已跳过");
      }
    });

  const title = firstNonEmpty([
    $("meta[property='og:title']").attr("content"),
    $("meta[name='twitter:title']").attr("content"),
    $("title").first().text(),
    $("h1").first().text(),
  ]);
  const publishedAt = firstNonEmpty([
    $("meta[property='article:published_time']").attr("content"),
    $("meta[property='og:published_time']").attr("content"),
    $("meta[itemprop='datePublished']").attr("content"),
    $("time[datetime]").first().attr("datetime"),
    ...jsonLd.map((value) => findJsonLdDate(value)),
  ]);
  const sourceName = firstNonEmpty([
    $("meta[property='og:site_name']").attr("content"),
    $("meta[name='application-name']").attr("content"),
  ]);
  const canonicalUrl = absoluteHttpUrl(
    $("link[rel~='canonical']").first().attr("href"),
    pageUrl,
  );

  const attachmentMap = new Map<string, HtmlPdfAttachment>();
  $("a[href]").each((_, node) => {
    if (attachmentMap.size >= maxAttachments) return;
    const element = $(node);
    const href = element.attr("href");
    const absolute = absoluteHttpUrl(href, pageUrl);
    if (!absolute) return;
    const type = (element.attr("type") ?? "").toLowerCase();
    let pathname = "";
    try {
      pathname = new URL(absolute).pathname.toLowerCase();
    } catch {
      return;
    }
    if (!pathname.endsWith(".pdf") && type !== "application/pdf") return;
    attachmentMap.set(absolute, {
      url: absolute,
      label: (normalizeInlineText(element.text()) || "PDF 附件").slice(0, 500),
    });
  });

  $(REMOVED_ELEMENTS).remove();
  let text = "";
  for (const selector of BODY_CANDIDATES) {
    $(selector).each((index) => {
      const candidate = collectReadableText($, `${selector}:eq(${index})`);
      if (candidate.length > text.length) text = candidate;
    });
  }
  if (!text) text = collectReadableText($, "body");
  if (!text) text = normalizeDocumentText($.root().text());

  if (text.length > maxTextChars) {
    text = text.slice(0, maxTextChars).trimEnd();
    warnings.push(`网页正文超过 ${maxTextChars} 字符，已截断`);
  }
  if (!text) warnings.push("网页未提取到可用正文");

  return {
    title,
    publishedAt,
    canonicalUrl,
    sourceName,
    text,
    jsonLd,
    pdfAttachments: [...attachmentMap.values()],
    warnings,
  };
}
