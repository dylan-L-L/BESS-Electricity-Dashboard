import { describe, expect, it } from "vitest";

import { extractHtmlDocument } from "../../src/lib/imports/html-extractor";

describe("HTML import extraction", () => {
  it("extracts metadata, readable content and PDF attachments", () => {
    const result = extractHtmlDocument(
      `<!doctype html>
      <html lang="zh-CN">
        <head>
          <title>备用标题</title>
          <meta property="og:title" content="山东省电力市场政策">
          <meta property="article:published_time" content="2026-07-20">
          <meta property="og:site_name" content="山东省能源局">
          <link rel="canonical" href="/policy/canonical#section">
          <script type="application/ld+json">
            {"@type":"NewsArticle","datePublished":"2026-07-19"}
          </script>
          <script>window.secret = "不应出现"</script>
        </head>
        <body>
          <nav>导航不应出现</nav>
          <article>
            <h1>山东省电力市场政策</h1>
            <p>正文第一段。</p>
            <table><tr><td>容量电价</td><td>100 元/kW·年</td></tr></table>
            <a href="/files/rule.pdf">政策附件</a>
            <a href="/download?id=2" type="application/pdf">计算表</a>
          </article>
        </body>
      </html>`,
      "https://energy.example/notices/1",
    );

    expect(result.title).toBe("山东省电力市场政策");
    expect(result.publishedAt).toBe("2026-07-20");
    expect(result.sourceName).toBe("山东省能源局");
    expect(result.canonicalUrl).toBe(
      "https://energy.example/policy/canonical",
    );
    expect(result.jsonLd).toEqual([
      { "@type": "NewsArticle", datePublished: "2026-07-19" },
    ]);
    expect(result.text).toContain("正文第一段。");
    expect(result.text).toContain("容量电价 | 100 元/kW·年");
    expect(result.text).not.toContain("导航不应出现");
    expect(result.text).not.toContain("不应出现");
    expect(result.pdfAttachments).toEqual([
      {
        url: "https://energy.example/files/rule.pdf",
        label: "政策附件",
      },
      {
        url: "https://energy.example/download?id=2",
        label: "计算表",
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("skips malformed JSON-LD and applies deterministic text limits", () => {
    const result = extractHtmlDocument(
      `<html><head>
        <script type="application/ld+json">{not-json}</script>
       </head><body><main><p>1234567890</p></main></body></html>`,
      "https://example.com/",
      { maxTextChars: 5 },
    );

    expect(result.text).toBe("12345");
    expect(result.jsonLd).toEqual([]);
    expect(result.warnings).toContain("存在无法解析的 JSON-LD，已跳过");
    expect(result.warnings).toContain("网页正文超过 5 字符，已截断");
  });
});
