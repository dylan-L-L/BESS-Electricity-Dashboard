import type {
  AdminProvinceTopicQuery,
  CreateProvinceTopicField,
  CreateProvinceTopicRecord,
  ProvinceTopicRepository,
  PublicProvinceTopicQuery,
  UpdateProvinceTopicRecord,
} from "@/lib/repositories/contracts";
import type {
  ProvinceTopicField,
  ProvinceTopicRecord,
  ProvinceTopicRecordWithFields,
} from "@/lib/types";

function copyRecord(record: ProvinceTopicRecord): ProvinceTopicRecord {
  return { ...record };
}

function copyField(field: ProvinceTopicField): ProvinceTopicField {
  return { ...field };
}

export class InMemoryProvinceTopicRepository
  implements ProvinceTopicRepository
{
  protected readonly records = new Map<string, ProvinceTopicRecord>();
  protected readonly fields = new Map<string, ProvinceTopicField[]>();
  private nextRecordId = 1;
  private nextFieldId = 1;

  constructor(seed: ProvinceTopicRecordWithFields[] = []) {
    for (const record of seed) {
      const { fields, ...base } = record;
      this.records.set(record.id, copyRecord(base));
      this.fields.set(record.id, fields.map(copyField));
    }
  }

  async listAdmin(
    query: AdminProvinceTopicQuery = {},
  ): Promise<ProvinceTopicRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          (!query.region_id || record.region_id === query.region_id) &&
          (!query.topic_id || record.topic_id === query.topic_id) &&
          (!query.review_status ||
            record.review_status === query.review_status),
      )
      .map(copyRecord);
  }

  async listPublic(
    query: PublicProvinceTopicQuery = {},
  ): Promise<ProvinceTopicRecordWithFields[]> {
    return [...this.records.values()]
      .filter((record) => {
        const inRegion = query.region_ids
          ? query.region_ids.includes(record.region_id)
          : !query.region_id || record.region_id === query.region_id;
        return (
          record.review_status === "published" &&
          record.published_at !== null &&
          inRegion &&
          (!query.topic_id || record.topic_id === query.topic_id)
        );
      })
      .map((record) => ({
        ...copyRecord(record),
        fields: (this.fields.get(record.id) ?? []).map(copyField),
      }));
  }

  async getAdminById(
    id: string,
  ): Promise<ProvinceTopicRecordWithFields | null> {
    const record = this.records.get(id);
    if (!record) return null;
    return {
      ...copyRecord(record),
      fields: (this.fields.get(id) ?? []).map(copyField),
    };
  }

  async create(
    input: CreateProvinceTopicRecord,
  ): Promise<ProvinceTopicRecord> {
    const record = {
      id: `province-topic-${this.nextRecordId++}`,
      ...input,
    };
    this.records.set(record.id, copyRecord(record));
    return copyRecord(record);
  }

  async update(
    id: string,
    input: UpdateProvinceTopicRecord,
  ): Promise<ProvinceTopicRecord> {
    const current = this.records.get(id);
    if (!current) throw new Error(`Province topic ${id} does not exist`);
    const updated = { ...current, ...input };
    this.records.set(id, copyRecord(updated));
    return copyRecord(updated);
  }

  async replaceFields(
    recordId: string,
    input: CreateProvinceTopicField[],
  ): Promise<ProvinceTopicField[]> {
    const fields = input.map((field) => ({
      id: `province-topic-field-${this.nextFieldId++}`,
      ...field,
    }));
    this.fields.set(recordId, fields.map(copyField));
    return fields.map(copyField);
  }
}

export class LeakyProvinceTopicRepository extends InMemoryProvinceTopicRepository {
  override async listPublic(
    query: PublicProvinceTopicQuery = {},
  ): Promise<ProvinceTopicRecordWithFields[]> {
    const records = await this.listAdmin({
      region_id: query.region_id,
      topic_id: query.topic_id,
    });
    return Promise.all(
      records.map(async (record) => {
        const full = await this.getAdminById(record.id);
        if (!full) throw new Error("Missing in-memory topic record");
        return full;
      }),
    );
  }
}

export function makeProvinceTopicRecord(
  overrides: Partial<ProvinceTopicRecordWithFields> = {},
): ProvinceTopicRecordWithFields {
  const timestamp = "2026-07-24T08:00:00.000Z";
  const recordId = overrides.id ?? "province-topic-fixture";
  const defaultFields: ProvinceTopicField[] = [
    "spot_day_ahead_rule",
    "spot_real_time_rule",
    "ancillary_trading_rule",
    "retail_trading_rule",
  ].map((fieldKey, index) => ({
    id: `field-${index + 1}`,
    record_id: recordId,
    field_key: fieldKey,
    value_text: "示例规则",
    value_numeric: null,
    unit: null,
    coverage_status: "available",
    applicability: "示例适用范围",
    source_url: "https://example.com/source",
    source_name: "示例来源",
    source_locator: `第 ${index + 1} 条`,
    evidence_excerpt: null,
    sort_order: index,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  return {
    id: recordId,
    region_id: "00000000-0000-4000-8000-000000000003",
    topic_id: "trading-rules",
    title: "山东现货市场规则",
    summary: "已核验示例摘要",
    legal_status: "effective",
    operational_status: "continuous",
    valid_from: "2026-01-01",
    valid_to: null,
    as_of_date: "2026-07-24",
    source_url: "https://example.com/source",
    source_name: "示例来源",
    source_published_at: "2026-01-01",
    reviewer_note: "人工核验完成",
    review_status: "published",
    published_at: timestamp,
    reviewer_id: "admin-1",
    reviewed_at: timestamp,
    created_by: "admin-1",
    is_demo: false,
    created_at: timestamp,
    updated_at: timestamp,
    fields: defaultFields,
    ...overrides,
  };
}
