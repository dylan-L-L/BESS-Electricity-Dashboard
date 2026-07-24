export const REGION_TYPES = [
  "global",
  "continent",
  "country",
  "province",
] as const;
export type RegionType = (typeof REGION_TYPES)[number];

export const SIGNAL_TYPES = ["policy", "market"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const REVIEW_STATUSES = [
  "ai_draft",
  "pending_review",
  "published",
  "rejected",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const NORMALIZED_STATUSES = [
  "draft",
  "consultation",
  "filed",
  "approved",
  "effective",
  "suspended",
  "other",
] as const;
export type NormalizedStatus = (typeof NORMALIZED_STATUSES)[number];

export interface Region {
  id: string;
  slug: string;
  code: string | null;
  name_zh: string;
  name_en: string | null;
  region_type: RegionType;
  parent_id: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A signal can be incomplete while it is under review. Publication requirements
 * are intentionally enforced by the domain service instead of being hidden in
 * this storage-shaped type.
 */
export interface Signal {
  id: string;
  region_id: string | null;
  signal_type: SignalType;
  title: string | null;
  summary: string | null;
  category: string | null;
  original_status: string | null;
  normalized_status: NormalizedStatus | null;
  event_date: string | null;
  effective_date: string | null;
  impact_channel: string | null;
  impact_direction: string | null;
  impact_level: string | null;
  source_url: string | null;
  source_name: string | null;
  reviewer_note: string | null;
  review_status: ReviewStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
  reviewer_id?: string | null;
  reviewed_at: string | null;
  created_by?: string | null;
}

export interface MarketMetric {
  id: string;
  region_id: string;
  metric_key: string;
  label: string;
  value: number | null;
  unit: string | null;
  period_label: string | null;
  as_of_date: string | null;
  source_url: string | null;
  source_name: string | null;
  notes: string | null;
  is_demo: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export const PROVINCE_TOPIC_LEGAL_STATUSES = [
  "draft",
  "consultation",
  "published",
  "effective",
  "suspended",
  "superseded",
  "other",
] as const;
export type ProvinceTopicLegalStatus =
  (typeof PROVINCE_TOPIC_LEGAL_STATUSES)[number];

export const PROVINCE_TOPIC_OPERATIONAL_STATUSES = [
  "not_started",
  "simulation",
  "trial",
  "continuous",
  "suspended",
  "unknown",
] as const;
export type ProvinceTopicOperationalStatus =
  (typeof PROVINCE_TOPIC_OPERATIONAL_STATUSES)[number];

/**
 * Every public topic card has an explicit field coverage state. `available`
 * means that a reviewed value and its field-level source locator are present.
 * Missing information is never encoded as numeric zero.
 */
export const PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES = [
  "available",
  "not_covered",
  "not_published",
  "not_applicable",
  "stale",
  "conflicting",
] as const;
export type ProvinceTopicFieldCoverageStatus =
  (typeof PROVINCE_TOPIC_FIELD_COVERAGE_STATUSES)[number];

export interface ProvinceTopicField {
  id: string;
  record_id: string;
  field_key: string;
  value_text: string | null;
  value_numeric: number | null;
  unit: string | null;
  coverage_status: ProvinceTopicFieldCoverageStatus;
  applicability: string | null;
  source_url: string | null;
  source_name: string | null;
  source_locator: string | null;
  evidence_excerpt: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProvinceTopicRecord {
  id: string;
  region_id: string;
  topic_id: import("./china-market/taxonomy").ChinaMarketTopicId;
  title: string | null;
  summary: string | null;
  legal_status: ProvinceTopicLegalStatus | null;
  operational_status: ProvinceTopicOperationalStatus | null;
  valid_from: string | null;
  valid_to: string | null;
  as_of_date: string | null;
  source_url: string | null;
  source_name: string | null;
  source_published_at: string | null;
  reviewer_note: string | null;
  review_status: ReviewStatus;
  published_at: string | null;
  reviewer_id?: string | null;
  reviewed_at: string | null;
  created_by?: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProvinceTopicRecordWithFields extends ProvinceTopicRecord {
  fields: ProvinceTopicField[];
}

export type ActorRole = "admin" | "reviewer" | "viewer";

export interface Actor {
  id: string;
  role: ActorRole;
  email?: string;
}
