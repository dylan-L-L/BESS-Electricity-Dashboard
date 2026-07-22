import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OpenAiStructuredExtractor } from "@/lib/imports/ai";

const parsedResult = {
  items: [
    {
      target_type: "signal" as const,
      is_relevant: true,
      region_code: "CN-SD",
      signal_type: "policy" as const,
      title: "山东政策",
      summary: "仅用于 AI 重试单元测试。",
      category: null,
      original_status: "备案",
      normalized_status: "filed" as const,
      event_date: "2026-07-22",
      effective_date: null,
      impact_channel: null,
      impact_direction: null,
      impact_level: null,
      source_name: "Demo source",
      source_url: "https://example.com/policy",
      confidence: 0.9,
      evidence: [
        {
          field: "normalized_status",
          location: "正文",
          page: null,
          sheet: null,
          row: null,
          quote: "备案",
        },
      ],
      warnings: [],
    },
  ],
  warnings: [],
};

describe("OpenAI structured import retry", () => {
  it("retries once when the first response has no schema-validated payload", async () => {
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        id: "resp-invalid",
        model: "test-model",
        status: "completed",
        output: [],
        output_parsed: null,
      })
      .mockResolvedValueOnce({
        id: "resp-valid",
        model: "test-model",
        status: "completed",
        output: [],
        output_parsed: parsedResult,
      });
    const client = { responses: { parse } } as unknown as OpenAI;
    const extractor = new OpenAiStructuredExtractor({ client, model: "test-model" });

    const result = await extractor.extract({
      inputType: "url",
      inputName: "Demo policy",
      sourceUrl: "https://example.com/policy",
      extractedText: "山东政策现予备案。",
      regions: [
        {
          code: "CN-SD",
          name_zh: "山东",
          name_en: "Shandong",
          region_type: "province",
        },
      ],
      adminId: "admin-test",
    });

    expect(parse).toHaveBeenCalledTimes(2);
    expect(result.responseId).toBe("resp-valid");
    expect(result.data.items[0]).toMatchObject({
      target_type: "signal",
      normalized_status: "filed",
    });
  });
});
