import {
  getChinaMarketFieldKeys,
  getChinaMarketTopic,
} from "../china-market/taxonomy";
import {
  provinceTopicDraftInputSchema,
  type ParsedProvinceTopicDraftInput,
  type ProvinceTopicDraftInput,
} from "../china-market/schemas";
import {
  AuthenticationRequiredError,
  ForbiddenError,
  ProvinceTopicDraftValidationError,
  ProvinceTopicNotFoundError,
  ProvinceTopicPublishValidationError,
  RejectionValidationError,
} from "../domain/errors";
import { rejectionInputSchema } from "../domain/schemas";
import { zodFieldErrors } from "../domain/validation";
import type {
  CreateProvinceTopicField,
  CreateProvinceTopicRecord,
  ProvinceTopicRepository,
  PublicProvinceTopicQuery,
  UpdateProvinceTopicRecord,
} from "../repositories/contracts";
import type {
  Actor,
  ProvinceTopicRecord,
  ProvinceTopicRecordWithFields,
} from "../types";

export type ProvinceTopicClock = () => Date;

function requireAdmin(actor: Actor | null | undefined): Actor {
  if (!actor) throw new AuthenticationRequiredError();
  if (actor.role !== "admin") throw new ForbiddenError();
  return actor;
}

function isHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function validateExpectedFields(input: ParsedProvinceTopicDraftInput) {
  const expected = getChinaMarketFieldKeys(input.topic_id);
  const received = input.fields.map((field) => field.field_key);
  const duplicates = received.filter(
    (key, index) => received.indexOf(key) !== index,
  );
  const missing = expected.filter((key) => !received.includes(key));
  const unexpected = received.filter((key) => !expected.includes(key));

  if (
    duplicates.length ||
    missing.length ||
    unexpected.length ||
    received.length !== expected.length
  ) {
    throw new ProvinceTopicDraftValidationError({
      fields: [
        ...(missing.length ? [`缺少字段：${missing.join("、")}`] : []),
        ...(unexpected.length
          ? [`字段不属于所选专题：${unexpected.join("、")}`]
          : []),
        ...(duplicates.length
          ? [`字段重复：${[...new Set(duplicates)].join("、")}`]
          : []),
      ],
    });
  }
}

function recordFields(
  input: ParsedProvinceTopicDraftInput,
  recordId: string,
  now: string,
): CreateProvinceTopicField[] {
  const definition = getChinaMarketTopic(input.topic_id);
  const inputByKey = new Map(
    input.fields.map((field) => [field.field_key, field]),
  );

  return (definition?.fields ?? []).map((fieldDefinition, sortOrder) => {
    const field = inputByKey.get(fieldDefinition.key);
    if (!field) {
      throw new ProvinceTopicDraftValidationError({
        fields: [`缺少字段：${fieldDefinition.key}`],
      });
    }
    return {
      record_id: recordId,
      field_key: field.field_key,
      value_text: field.value_text,
      value_numeric: field.value_numeric,
      unit: field.unit,
      coverage_status: field.coverage_status,
      applicability: field.applicability,
      source_url: field.source_url ?? input.source_url,
      source_name: field.source_name ?? input.source_name,
      source_locator: field.source_locator,
      evidence_excerpt: field.evidence_excerpt,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now,
    };
  });
}

function recordInput(
  input: ParsedProvinceTopicDraftInput,
): Omit<
  CreateProvinceTopicRecord,
  | "review_status"
  | "published_at"
  | "reviewer_id"
  | "reviewed_at"
  | "created_by"
  | "created_at"
  | "updated_at"
> {
  return {
    region_id: input.region_id,
    topic_id: input.topic_id,
    title: input.title,
    summary: input.summary,
    legal_status: input.legal_status,
    operational_status: input.operational_status,
    valid_from: input.valid_from,
    valid_to: input.valid_to,
    as_of_date: input.as_of_date,
    source_url: input.source_url,
    source_name: input.source_name,
    source_published_at: input.source_published_at,
    reviewer_note: input.reviewer_note,
    is_demo: input.is_demo,
  };
}

function validatePublishable(
  record: ProvinceTopicRecordWithFields,
  reviewerNote: string,
) {
  const errors: Record<string, string[]> = {};
  const required = (
    key: string,
    value: string | null,
    message: string,
  ) => {
    if (!value?.trim()) errors[key] = [message];
  };

  required("title", record.title, "标题必填");
  required("source_name", record.source_name, "主来源名称必填");
  required("reviewer_note", reviewerNote, "人工审核说明必填");
  if (!record.legal_status) errors.legal_status = ["法律状态必填"];
  if (!record.as_of_date) errors.as_of_date = ["核验截至日期必填"];
  if (!isHttpUrl(record.source_url)) {
    errors.source_url = ["主来源必须是 HTTP(S) 链接"];
  }

  const expected = getChinaMarketFieldKeys(record.topic_id);
  const fieldsByKey = new Map(
    record.fields.map((field) => [field.field_key, field]),
  );
  if (
    fieldsByKey.size !== expected.length ||
    expected.some((key) => !fieldsByKey.has(key))
  ) {
    errors.fields = ["每个专题字段都必须有明确的值或覆盖状态"];
  }

  for (const key of expected) {
    const field = fieldsByKey.get(key);
    if (!field) continue;
    const hasValue =
      Boolean(field.value_text?.trim()) || field.value_numeric !== null;
    if (field.coverage_status === "available" && !field.value_text?.trim()) {
      errors[`fields.${key}.value_text`] = ["已覆盖字段必须填写原始展示值"];
    }
    if (
      hasValue &&
      (!isHttpUrl(field.source_url) ||
        !field.source_name?.trim() ||
        !field.source_locator?.trim())
    ) {
      errors[`fields.${key}.source`] = [
        "有值的字段必须有 HTTP(S) 来源、来源名称和页码/表格/段落定位",
      ];
    }
  }

  if (Object.keys(errors).length) {
    throw new ProvinceTopicPublishValidationError(errors);
  }
}

export class ProvinceTopicService {
  constructor(
    private readonly repository: ProvinceTopicRepository,
    private readonly clock: ProvinceTopicClock = () => new Date(),
  ) {}

  async saveDraft(
    actor: Actor | null | undefined,
    input: ProvinceTopicDraftInput,
    recordId?: string,
  ): Promise<ProvinceTopicRecordWithFields> {
    const admin = requireAdmin(actor);
    const result = provinceTopicDraftInputSchema.safeParse(input);
    if (!result.success) {
      throw new ProvinceTopicDraftValidationError(
        zodFieldErrors(result.error),
      );
    }
    validateExpectedFields(result.data);

    const now = this.clock().toISOString();
    let record: ProvinceTopicRecord;
    if (recordId) {
      const existing = await this.repository.getAdminById(recordId);
      if (!existing) throw new ProvinceTopicNotFoundError(recordId);
      const patch: UpdateProvinceTopicRecord = {
        ...recordInput(result.data),
        review_status: "pending_review",
        published_at: null,
        reviewer_id: null,
        reviewed_at: null,
        updated_at: now,
      };
      record = await this.repository.update(recordId, patch);
    } else {
      record = await this.repository.create({
        ...recordInput(result.data),
        review_status: "pending_review",
        published_at: null,
        reviewer_id: null,
        reviewed_at: null,
        created_by: admin.id,
        created_at: now,
        updated_at: now,
      });
    }

    const fields = await this.repository.replaceFields(
      record.id,
      recordFields(result.data, record.id, now),
    );
    return { ...record, fields };
  }

  async publish(
    actor: Actor | null | undefined,
    recordId: string,
    reviewerNote: string,
  ): Promise<ProvinceTopicRecordWithFields> {
    const admin = requireAdmin(actor);
    const record = await this.repository.getAdminById(recordId);
    if (!record) throw new ProvinceTopicNotFoundError(recordId);
    validatePublishable(record, reviewerNote);

    const now = this.clock().toISOString();
    const updated = await this.repository.update(recordId, {
      reviewer_note: reviewerNote.trim(),
      review_status: "published",
      published_at: now,
      reviewer_id: admin.id,
      reviewed_at: now,
      updated_at: now,
    });
    return { ...updated, fields: record.fields };
  }

  async reject(
    actor: Actor | null | undefined,
    recordId: string,
    reviewerNote: string,
  ): Promise<ProvinceTopicRecordWithFields> {
    const admin = requireAdmin(actor);
    const parsed = rejectionInputSchema.safeParse({
      reviewer_note: reviewerNote,
    });
    if (!parsed.success) {
      throw new RejectionValidationError(zodFieldErrors(parsed.error));
    }
    const record = await this.repository.getAdminById(recordId);
    if (!record) throw new ProvinceTopicNotFoundError(recordId);

    const now = this.clock().toISOString();
    const updated = await this.repository.update(recordId, {
      reviewer_note: parsed.data.reviewer_note,
      review_status: "rejected",
      published_at: null,
      reviewer_id: admin.id,
      reviewed_at: now,
      updated_at: now,
    });
    return { ...updated, fields: record.fields };
  }

  async listPublic(
    query: PublicProvinceTopicQuery = {},
  ): Promise<ProvinceTopicRecordWithFields[]> {
    const records = await this.repository.listPublic(query);
    return records.filter(
      (record) =>
        record.review_status === "published" &&
        record.published_at !== null,
    );
  }
}
