import type { NormalizedStatus, SignalType } from "@/lib/types";

export const IMPORT_INPUT_TYPES = ["url", "pdf", "excel"] as const;
export type ImportInputType = (typeof IMPORT_INPUT_TYPES)[number];

export const IMPORT_JOB_STATUSES = [
  "pending",
  "processing",
  "review",
  "completed",
  "partial_failed",
  "failed",
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

export const IMPORT_TARGET_TYPES = [
  "signal",
  "market_metric",
  "unknown",
] as const;
export type ImportTargetType = (typeof IMPORT_TARGET_TYPES)[number];

export const IMPORT_ITEM_REVIEW_STATUSES = [
  "ai_draft",
  "pending_review",
  "approved",
  "rejected",
  "import_failed",
] as const;
export type ImportItemReviewStatus =
  (typeof IMPORT_ITEM_REVIEW_STATUSES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface ImportEvidence {
  field: string;
  location: string;
  page: number | null;
  sheet: string | null;
  row: number | null;
  quote: string;
}

export interface SignalImportDraft {
  target_type: "signal";
  is_relevant: boolean;
  region_code: string | null;
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
  source_name: string | null;
  source_url: string | null;
  confidence: number;
  evidence: ImportEvidence[];
  warnings: string[];
}

export interface MarketMetricImportDraft {
  target_type: "market_metric";
  is_relevant: boolean;
  region_code: string | null;
  metric_key: string | null;
  label: string | null;
  value: number | null;
  unit: string | null;
  period_label: string | null;
  as_of_date: string | null;
  source_name: string | null;
  source_url: string | null;
  notes: string | null;
  confidence: number;
  evidence: ImportEvidence[];
  warnings: string[];
}

export interface UnknownImportDraft {
  target_type: "unknown";
  is_relevant: boolean;
  reason: string | null;
  confidence: number;
  evidence: ImportEvidence[];
  warnings: string[];
}

export type StructuredImportDraft =
  | SignalImportDraft
  | MarketMetricImportDraft
  | UnknownImportDraft;

export type ExcelCellValue = string | number | boolean | null;

export interface ExcelPreviewRow {
  row_number: number;
  values: ExcelCellValue[];
  warnings: string[];
}

export interface ExcelSheetPreview {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  row_count: number;
  column_count: number;
  headers: string[];
  rows: ExcelPreviewRow[];
}

export interface ExcelWorkbookPreview {
  sheets: ExcelSheetPreview[];
  warnings: string[];
}

export type ExcelMapping = Record<string, string | null>;

export interface ExcelMappingSuggestion {
  sheet_name: string;
  target_type: "signal" | "market_metric";
  header_row: number;
  mappings: Array<{
    target_field: string;
    source_header: string | null;
  }>;
  confidence: number;
  warnings: string[];
}

export interface ImportJobMetadata {
  [key: string]:
    | JsonValue
    | ExcelWorkbookPreview
    | ExcelMappingSuggestion
    | undefined;
  workbook_preview?: ExcelWorkbookPreview;
  mapping_suggestion?: ExcelMappingSuggestion;
  selected_sheet?: string;
  selected_target_type?: "signal" | "market_metric";
  selected_mapping?: JsonObject;
  published_at_hint?: string | null;
  attachment_urls?: JsonValue[];
  excel_row_deduplication?: ExcelRowDeduplicationMetadata;
}

export type ExcelRowDeduplicationMetadata = {
  version: "excel-row-v1";
  notice: string;
  source_key: string | null;
  source_row_count: number;
  created_item_count: number;
  skipped_duplicate_count: number;
  historical_job_ids: string[];
  skipped_rows: Array<{
    sheet_name: string;
    source_row_number: number;
    target_type: "signal" | "market_metric";
    raw_row_hash: string;
    historical_job_id: string;
    historical_item_id: string;
  }>;
};

export interface ImportJob {
  id: string;
  input_type: ImportInputType;
  input_name: string;
  source_url: string | null;
  normalized_url: string | null;
  canonical_url: string | null;
  original_filename: string | null;
  workbook_source_key: string | null;
  storage_path: string | null;
  extracted_storage_path: string | null;
  source_mime_type: string | null;
  original_size_bytes: number | null;
  file_hash: string | null;
  content_hash: string | null;
  duplicate_of_job_id: string | null;
  input_metadata: ImportJobMetadata;
  extracted_text: string | null;
  status: ImportJobStatus;
  total_items: number;
  successful_items: number;
  failed_items: number;
  failure_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  technical_error: string | null;
  retryable: boolean;
  retry_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ExcelRowDeduplicationCandidate {
  source_row_number: number;
  raw_row_hash: string;
  raw_data: JsonObject;
}

export interface ExcelRowDuplicateMatch {
  requested_row_number: number;
  requested_raw_row_hash: string;
  historical_job_id: string;
  historical_item_id: string;
}

export interface ImportItem {
  id: string;
  import_job_id: string;
  item_index: number;
  target_type: ImportTargetType;
  source_location: JsonObject;
  sheet_name: string | null;
  source_row_number: number | null;
  source_part: number;
  raw_row_hash: string | null;
  raw_data: JsonObject;
  extracted_text: string | null;
  ai_result: JsonObject | null;
  draft_data: JsonObject | null;
  evidence: ImportEvidence[];
  confidence: number | null;
  warnings: string[];
  ai_provider: string | null;
  ai_model: string | null;
  ai_response_id: string | null;
  prompt_version: string | null;
  schema_version: string | null;
  review_status: ImportItemReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  approved_signal_id: string | null;
  approved_market_metric_id: string | null;
  approved_record_id: string | null;
  failure_stage: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourcePreview {
  input_type: ImportInputType;
  text: string | null;
  source_url: string | null;
  storage_path: string | null;
  signed_url: string | null;
  source_location: JsonObject;
}

export interface ImportApprovalResult {
  import_item_id: string;
  target_type: "signal" | "market_metric";
  record_id: string;
  already_approved: boolean;
}
