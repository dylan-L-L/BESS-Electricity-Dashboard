import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ExcelRowDeduplicationCandidate,
  ExcelRowDuplicateMatch,
  ImportApprovalResult,
  ImportInputType,
  ImportItem,
  ImportJob,
  ImportJobStatus,
  ImportTargetType,
  JsonObject,
} from "@/lib/imports/types";

export class ImportPersistenceError extends Error {
  readonly status = 500;
  readonly code = "IMPORT_DATABASE_ERROR";

  constructor(operation: string, detail?: string) {
    super(`导入数据库操作失败：${operation}${detail ? `（${detail}）` : ""}`);
    this.name = "ImportPersistenceError";
  }
}

function throwIfError(operation: string, error: { message: string } | null) {
  if (error) throw new ImportPersistenceError(operation, error.message);
}

export type CreateImportJobInput = Pick<
  ImportJob,
  | "input_type"
  | "input_name"
  | "source_url"
  | "normalized_url"
  | "canonical_url"
  | "original_filename"
  | "storage_path"
  | "extracted_storage_path"
  | "source_mime_type"
  | "original_size_bytes"
  | "file_hash"
  | "content_hash"
  | "duplicate_of_job_id"
  | "input_metadata"
  | "extracted_text"
  | "created_by"
> & { status?: ImportJobStatus };

export type CreateImportItemInput = Omit<
  ImportItem,
  | "id"
  | "approved_record_id"
  | "created_at"
  | "updated_at"
  | "reviewed_at"
  | "reviewed_by"
  | "approved_signal_id"
  | "approved_market_metric_id"
>;

export class SupabaseImportRepository {
  constructor(readonly client: SupabaseClient) {}

  async listJobs(limit = 100): Promise<ImportJob[]> {
    const { data, error } = await this.client
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    throwIfError("读取导入任务", error);
    return (data ?? []) as unknown as ImportJob[];
  }

  async getJob(id: string): Promise<ImportJob | null> {
    const { data, error } = await this.client
      .from("import_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError("读取导入任务详情", error);
    return (data as unknown as ImportJob | null) ?? null;
  }

  async getItems(jobId: string): Promise<ImportItem[]> {
    const { data, error } = await this.client
      .from("import_items")
      .select("*")
      .eq("import_job_id", jobId)
      .order("item_index");
    throwIfError("读取导入条目", error);
    return (data ?? []) as unknown as ImportItem[];
  }

  async getItem(id: string): Promise<ImportItem | null> {
    const { data, error } = await this.client
      .from("import_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError("读取导入条目详情", error);
    return (data as unknown as ImportItem | null) ?? null;
  }

  async findUrlDuplicate(normalizedUrl: string): Promise<ImportJob | null> {
    const { data, error } = await this.client
      .from("import_jobs")
      .select("*")
      .eq("input_type", "url")
      .eq("normalized_url", normalizedUrl)
      .is("duplicate_of_job_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    throwIfError("检查 URL 去重", error);
    return (data as unknown as ImportJob | null) ?? null;
  }

  async findFileDuplicate(
    inputType: Exclude<ImportInputType, "url">,
    fileHash: string,
    excludeId?: string,
  ): Promise<ImportJob | null> {
    let query = this.client
      .from("import_jobs")
      .select("*")
      .eq("input_type", inputType)
      .eq("file_hash", fileHash)
      .is("duplicate_of_job_id", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query.maybeSingle();
    throwIfError("检查文件去重", error);
    return (data as unknown as ImportJob | null) ?? null;
  }

  async findContentDuplicate(
    inputType: ImportInputType,
    contentHash: string,
    excludeId: string,
  ): Promise<ImportJob | null> {
    const { data, error } = await this.client
      .from("import_jobs")
      .select("*")
      .eq("input_type", inputType)
      .eq("content_hash", contentHash)
      .in("status", ["review", "completed", "partial_failed"])
      .neq("id", excludeId)
      .is("duplicate_of_job_id", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    throwIfError("检查内容去重", error);
    return (data as unknown as ImportJob | null) ?? null;
  }

  async createJob(input: CreateImportJobInput): Promise<ImportJob> {
    const { data, error } = await this.client
      .from("import_jobs")
      .insert({ status: "pending", ...input })
      .select("*")
      .single();
    throwIfError("创建导入任务", error);
    return data as unknown as ImportJob;
  }

  async updateJob(
    id: string,
    patch: Partial<Omit<ImportJob, "id" | "created_at" | "created_by">>,
  ): Promise<ImportJob> {
    const { data, error } = await this.client
      .from("import_jobs")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    throwIfError("更新导入任务", error);
    return data as unknown as ImportJob;
  }

  async claimJob(id: string): Promise<ImportJob | null> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("import_jobs")
      .update({
        status: "processing",
        started_at: now,
        completed_at: null,
        failure_stage: null,
        error_code: null,
        error_message: null,
        technical_error: null,
        retryable: false,
      })
      .eq("id", id)
      .in("status", ["pending", "failed"])
      .select("*")
      .maybeSingle();
    throwIfError("领取导入任务", error);
    return (data as unknown as ImportJob | null) ?? null;
  }

  async reclaimStaleJob(input: {
    id: string;
    expectedStartedAt: string | null;
    retryCount: number;
  }): Promise<ImportJob | null> {
    const now = new Date().toISOString();
    let query = this.client
      .from("import_jobs")
      .update({
        status: "processing",
        started_at: now,
        completed_at: null,
        failure_stage: null,
        error_code: null,
        error_message: null,
        technical_error: null,
        retryable: false,
        retry_count: input.retryCount,
      })
      .eq("id", input.id)
      .eq("status", "processing");
    query = input.expectedStartedAt
      ? query.eq("started_at", input.expectedStartedAt)
      : query.is("started_at", null);
    const { data, error } = await query.select("*").maybeSingle();
    throwIfError("回收超时导入任务", error);
    return (data as unknown as ImportJob | null) ?? null;
  }

  async createItems(inputs: CreateImportItemInput[]): Promise<ImportItem[]> {
    if (!inputs.length) return [];
    const { data, error } = await this.client
      .from("import_items")
      .insert(inputs)
      .select("*");
    throwIfError("创建导入条目", error);
    return (data ?? []) as unknown as ImportItem[];
  }

  async findExcelRowDuplicates(input: {
    currentJobId: string;
    targetType: "signal" | "market_metric";
    sheetName: string;
    rows: ExcelRowDeduplicationCandidate[];
  }): Promise<ExcelRowDuplicateMatch[]> {
    if (!input.rows.length) return [];
    const { data, error } = await this.client.rpc("find_excel_row_duplicates", {
      p_current_job_id: input.currentJobId,
      p_target_type: input.targetType,
      p_sheet_name: input.sheetName,
      p_rows: input.rows,
    });
    throwIfError("检查 Excel 历史行去重", error);
    return (data ?? []) as unknown as ExcelRowDuplicateMatch[];
  }

  async updateItem(
    id: string,
    patch: Partial<
      Pick<
        ImportItem,
        "target_type" | "draft_data" | "reviewer_note" | "review_status"
      >
    >,
  ): Promise<ImportItem> {
    const { data, error } = await this.client
      .from("import_items")
      .update(patch)
      .eq("id", id)
      .not("review_status", "eq", "approved")
      .select("*")
      .single();
    throwIfError("更新导入条目", error);
    return data as unknown as ImportItem;
  }

  async rejectItem(
    id: string,
    reviewerId: string,
    reviewerNote: string,
  ): Promise<ImportItem> {
    const { data, error } = await this.client
      .from("import_items")
      .update({
        review_status: "rejected",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        reviewer_note: reviewerNote,
      })
      .eq("id", id)
      .in("review_status", ["ai_draft", "pending_review"])
      .select("*")
      .single();
    throwIfError("驳回导入条目", error);
    return data as unknown as ImportItem;
  }

  async approveItem(input: {
    id: string;
    targetType: Exclude<ImportTargetType, "unknown">;
    draftData: JsonObject;
    reviewerNote: string;
  }): Promise<ImportApprovalResult> {
    const { data, error } = await this.client.rpc("approve_import_item", {
      p_item_id: input.id,
      p_target_type: input.targetType,
      p_draft_data: input.draftData,
      p_reviewer_note: input.reviewerNote,
    });
    throwIfError("批准导入条目", error);
    return data as unknown as ImportApprovalResult;
  }
}
