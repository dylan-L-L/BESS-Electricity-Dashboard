import { describe, expect, it } from "vitest";

import { CHINA_MARKET_TOPICS } from "@/lib/china-market/taxonomy";
import {
  ProvinceTopicDraftValidationError,
  ProvinceTopicPublishValidationError,
} from "@/lib/domain/errors";
import { ProvinceTopicService } from "@/lib/services/province-topic-service";
import type { Actor } from "@/lib/types";
import {
  InMemoryProvinceTopicRepository,
  LeakyProvinceTopicRepository,
  makeProvinceTopicRecord,
} from "../helpers/in-memory-province-topic-repository";

const admin: Actor = { id: "admin-1", role: "admin" };
const fixedClock = () => new Date("2026-07-24T09:30:00.000Z");

function draftInput() {
  const topic = CHINA_MARKET_TOPICS[0];
  return {
    region_id: "00000000-0000-4000-8000-000000000003",
    topic_id: topic.id,
    title: "山东电力市场交易规则",
    summary: "逐字段核验",
    legal_status: "effective" as const,
    operational_status: "continuous" as const,
    valid_from: "2026-01-01",
    valid_to: "",
    as_of_date: "2026-07-24",
    source_url: "https://example.com/main-source",
    source_name: "主来源",
    source_published_at: "2026-01-01",
    reviewer_note: "待发布核验",
    is_demo: false,
    fields: topic.fields.map((field) => ({
      field_key: field.key,
      value_text: "",
      value_numeric: null,
      unit: "",
      coverage_status: "not_covered" as const,
      applicability: "",
      source_url: "",
      source_name: "",
      source_locator: "",
      evidence_excerpt: "",
    })),
  };
}

describe("ProvinceTopicService", () => {
  it("saves a complete field-key scaffold without inventing missing values", async () => {
    const repository = new InMemoryProvinceTopicRepository();
    const service = new ProvinceTopicService(repository, fixedClock);

    const saved = await service.saveDraft(admin, draftInput());

    expect(saved.review_status).toBe("pending_review");
    expect(saved.fields).toHaveLength(4);
    expect(
      saved.fields.every(
        (field) =>
          field.value_text === null &&
          field.value_numeric === null &&
          field.coverage_status === "not_covered",
      ),
    ).toBe(true);
  });

  it("rejects a draft whose field keys do not match its selected topic", async () => {
    const repository = new InMemoryProvinceTopicRepository();
    const service = new ProvinceTopicService(repository, fixedClock);
    const input = draftInput();
    input.fields = input.fields.slice(1);

    await expect(service.saveDraft(admin, input)).rejects.toBeInstanceOf(
      ProvinceTopicDraftValidationError,
    );
  });

  it("requires field-level source location before publishing a value", async () => {
    const record = makeProvinceTopicRecord();
    record.fields[0] = {
      ...record.fields[0],
      source_locator: null,
    };
    const repository = new InMemoryProvinceTopicRepository([record]);
    const service = new ProvinceTopicService(repository, fixedClock);

    await expect(
      service.publish(admin, record.id, "已人工核验"),
    ).rejects.toBeInstanceOf(ProvinceTopicPublishValidationError);
  });

  it("publishes explicit missing-data states without coercing them to zero", async () => {
    const repository = new InMemoryProvinceTopicRepository();
    const service = new ProvinceTopicService(repository, fixedClock);
    const draft = await service.saveDraft(admin, draftInput());

    const published = await service.publish(
      admin,
      draft.id,
      "确认截至日期内尚未完成字段覆盖",
    );

    expect(published.review_status).toBe("published");
    expect(published.fields.every((field) => field.value_numeric === null)).toBe(
      true,
    );
  });

  it("defensively removes drafts returned by a leaky public adapter", async () => {
    const published = makeProvinceTopicRecord();
    const draft = makeProvinceTopicRecord({
      id: "draft-topic",
      review_status: "pending_review",
      published_at: null,
    });
    const service = new ProvinceTopicService(
      new LeakyProvinceTopicRepository([published, draft]),
      fixedClock,
    );

    const records = await service.listPublic();
    expect(records.map((record) => record.id)).toEqual([published.id]);
  });
});
