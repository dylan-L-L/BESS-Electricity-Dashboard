import { describe, expect, it } from "vitest";

import {
  aiImportResponseSchema,
  marketMetricImportDraftSchema,
  signalImportDraftSchema,
} from "@/lib/imports/schemas";
import { assertImportDraftApprovable } from "@/lib/imports/validation";

const evidence = [
  {
    field: "normalized_status",
    location: "正文第 1 段",
    page: null,
    sheet: null,
    row: null,
    quote: "现予备案",
  },
];

const signal = {
  target_type: "signal" as const,
  is_relevant: true,
  region_code: "CN-SD",
  signal_type: "policy" as const,
  title: "山东政策",
  summary: "仅用于结构校验。",
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
  confidence: 0.8,
  evidence,
  warnings: [],
};

describe("AI import schema and approval invariants", () => {
  it("keeps Filed, Approved, Draft and Effective as distinct values", () => {
    const values = ["filed", "approved", "draft", "effective"] as const;
    const parsed = values.map((normalized_status) =>
      signalImportDraftSchema.parse({ ...signal, normalized_status }).normalized_status,
    );

    expect(parsed).toEqual(values);
    expect(new Set(parsed).size).toBe(4);
  });

  it("preserves a real zero and never coerces null to zero", () => {
    const base = {
      target_type: "market_metric" as const,
      is_relevant: true,
      region_code: "CN-SD",
      metric_key: "demo_metric",
      label: "Demo 指标",
      unit: "CNY/kWh",
      period_label: null,
      as_of_date: null,
      source_name: "Demo source",
      source_url: null,
      notes: null,
      confidence: 0.9,
      evidence: [{ ...evidence[0], field: "value", quote: "0 CNY/kWh" }],
      warnings: [],
    };

    expect(marketMetricImportDraftSchema.parse({ ...base, value: 0 }).value).toBe(0);
    expect(marketMetricImportDraftSchema.parse({ ...base, value: null }).value).toBeNull();
  });

  it("requires a metric unit before human approval", () => {
    const draft = marketMetricImportDraftSchema.parse({
      target_type: "market_metric",
      is_relevant: true,
      region_code: "CN-SD",
      metric_key: "demo_metric",
      label: "Demo 指标",
      value: 0,
      unit: null,
      period_label: null,
      as_of_date: null,
      source_name: "Demo source",
      source_url: null,
      notes: null,
      confidence: 0.9,
      evidence: [{ ...evidence[0], field: "value", quote: "0" }],
      warnings: [],
    });

    expect(() =>
      assertImportDraftApprovable({
        inputType: "url",
        targetType: "market_metric",
        draftData: draft,
        evidence: draft.evidence,
        sourceLocation: { url: "https://example.com" },
        reviewerNote: "已人工核对",
        regions: [{ code: "CN-SD" }],
      }),
    ).toThrow(/批准条件/);
  });

  it("requires PDF page evidence and accepts strict structured output only", () => {
    const withoutPage = { ...signal, evidence };
    expect(() =>
      assertImportDraftApprovable({
        inputType: "pdf",
        targetType: "signal",
        draftData: withoutPage,
        evidence,
        sourceLocation: {},
        reviewerNote: "已人工核对",
        regions: [{ code: "CN-SD" }],
      }),
    ).toThrow(/批准条件/);

    expect(
      aiImportResponseSchema.safeParse({ items: [signal], warnings: [], commentary: "free text" })
        .success,
    ).toBe(false);
  });
});
