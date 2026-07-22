import "server-only";

import {
  IMPORT_PROMPT_VERSION,
  IMPORT_SCHEMA_VERSION,
  MAX_AI_INPUT_CHARS,
  type AiStructuredExtractor,
} from "@/lib/imports/ai";
import { extractHtmlDocument } from "@/lib/imports/html-extractor";
import { extractPdfText, type PdfPageText } from "@/lib/imports/pdf-extractor";
import {
  type CreateImportItemInput,
  SupabaseImportRepository,
} from "@/lib/imports/supabase-repository";
import {
  excelRowIdentityKey,
  normalizedExcelRowHash,
} from "@/lib/imports/excel-row-dedupe";
import {
  importObjectPath,
  sha256,
  SupabaseImportBlobStore,
} from "@/lib/imports/storage";
import type {
  ExcelCellValue,
  ExcelRowDeduplicationMetadata,
  ExcelMapping,
  ImportEvidence,
  ImportJob,
  ImportJobMetadata,
  JsonObject,
  JsonValue,
  StructuredImportDraft,
} from "@/lib/imports/types";
import { SafeUrlFetcher } from "@/lib/imports/url-fetcher";
import { validateEvidenceLocations } from "@/lib/imports/validation";
import { convertWorkbookRows } from "@/lib/imports/workbook";
import type { RegionRepository } from "@/lib/repositories/contracts";
import {
  NORMALIZED_STATUSES,
  SIGNAL_TYPES,
  type Region,
} from "@/lib/types";

export class ImportWorkflowError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 422,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ImportWorkflowError";
  }
}

type ProcessOptions = {
  sheet_name?: string;
  target_type?: "signal" | "market_metric";
  mapping?: ExcelMapping;
};

type ProcessResult = {
  job: ImportJob;
  duplicateOf?: ImportJob;
};

const PROCESSING_LEASE_MS = 10 * 60 * 1_000;

function jsonObject(value: unknown): JsonObject {
  return value as JsonObject;
}

function technicalMessage(error: unknown): string {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  return message.slice(0, 8_000);
}

function failureDetails(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
  status: number;
} {
  if (error instanceof ImportWorkflowError) {
    return error;
  }
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    retryable?: unknown;
    status?: unknown;
  };
  const code =
    typeof candidate?.code === "string"
      ? candidate.code
      : "IMPORT_PROCESSING_FAILED";
  const retryable =
    candidate?.retryable === true || ["TIMEOUT", "NETWORK_ERROR"].includes(code);
  const candidateStatus =
    typeof candidate?.status === "number" ? candidate.status : null;
  return {
    code,
    message:
      typeof candidate?.message === "string"
        ? candidate.message
        : "导入处理失败",
    retryable,
    status:
      candidateStatus && candidateStatus >= 400 && candidateStatus <= 599
        ? candidateStatus
        : retryable
          ? 503
          : 422,
  };
}

function requireJob(job: ImportJob | null): ImportJob {
  if (!job) {
    throw new ImportWorkflowError("导入任务不存在", "IMPORT_JOB_NOT_FOUND", 404);
  }
  return job;
}

function directText(value: ExcelCellValue | undefined, max = 20_000): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function directDate(value: ExcelCellValue | undefined): string | null {
  const text = directText(value, 10);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text
    ? null
    : text;
}

function directUrl(value: ExcelCellValue | undefined): string | null {
  const text = directText(value, 4_096);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function directNumber(value: ExcelCellValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveRegionCode(
  value: ExcelCellValue | undefined,
  regions: Region[],
): string | null {
  const input = directText(value, 500)?.toLocaleLowerCase("zh-CN");
  if (!input) return null;
  return (
    regions.find((region) =>
      [region.code, region.slug, region.name_zh, region.name_en]
        .filter((candidate): candidate is string => Boolean(candidate))
        .some((candidate) => candidate.toLocaleLowerCase("zh-CN") === input),
    )?.code ?? null
  );
}

function rowEvidence(
  sheet: string,
  row: number,
  rawData: Record<string, ExcelCellValue>,
): ImportEvidence[] {
  return [
    {
      field: "source_row",
      location: `${sheet} 第 ${row} 行`,
      page: null,
      sheet,
      row,
      quote: JSON.stringify(rawData).slice(0, 2_000),
    },
  ];
}

function excelDraft(input: {
  targetType: "signal" | "market_metric";
  mapped: Record<string, ExcelCellValue>;
  raw: Record<string, ExcelCellValue>;
  sheet: string;
  row: number;
  regions: Region[];
  rowWarnings: string[];
}): StructuredImportDraft {
  const evidence = rowEvidence(input.sheet, input.row, input.raw);
  const warnings = [...input.rowWarnings];
  const regionCode = resolveRegionCode(input.mapped.region_code, input.regions);
  if (!regionCode) warnings.push("地区无法与现有地区目录精确匹配，请人工确认");

  if (input.targetType === "signal") {
    const rawSignalType = directText(input.mapped.signal_type, 20);
    const signalType = SIGNAL_TYPES.includes(rawSignalType as (typeof SIGNAL_TYPES)[number])
      ? (rawSignalType as (typeof SIGNAL_TYPES)[number])
      : "policy";
    if (rawSignalType && rawSignalType !== signalType) {
      warnings.push("Signal 类型不是 policy/market，暂按 policy 展示并要求人工确认");
    } else if (!rawSignalType) {
      warnings.push("Signal 类型缺失，暂按 policy 展示并要求人工确认");
    }
    const rawStatus = directText(input.mapped.normalized_status, 50);
    const normalizedStatus = NORMALIZED_STATUSES.includes(
      rawStatus as (typeof NORMALIZED_STATUSES)[number],
    )
      ? (rawStatus as (typeof NORMALIZED_STATUSES)[number])
      : null;
    if (rawStatus && !normalizedStatus) {
      warnings.push("规范状态不在允许枚举中，已保留为空，不能直接批准");
    }

    return {
      target_type: "signal",
      is_relevant: true,
      region_code: regionCode,
      signal_type: signalType,
      title: directText(input.mapped.title, 500),
      summary: directText(input.mapped.summary),
      category: directText(input.mapped.category, 500),
      original_status: directText(input.mapped.original_status, 500),
      normalized_status: normalizedStatus,
      event_date: directDate(input.mapped.event_date),
      effective_date: directDate(input.mapped.effective_date),
      impact_channel: directText(input.mapped.impact_channel, 500),
      impact_direction: directText(input.mapped.impact_direction, 500),
      impact_level: directText(input.mapped.impact_level, 500),
      source_name: directText(input.mapped.source_name, 500),
      source_url: directUrl(input.mapped.source_url),
      confidence: 1,
      evidence,
      warnings,
    };
  }

  const rawMetricKey = directText(input.mapped.metric_key, 120);
  const metricKey =
    rawMetricKey && /^[a-z0-9][a-z0-9_-]{0,119}$/.test(rawMetricKey)
      ? rawMetricKey
      : null;
  if (rawMetricKey && !metricKey) {
    warnings.push("指标 Key 格式无效，已保留为空，不能直接批准");
  }
  const value = directNumber(input.mapped.value);
  if (input.mapped.value !== null && input.mapped.value !== undefined && value === null) {
    warnings.push("指标数值无法安全转换，已保留为 null，不会转换为 0");
  }
  return {
    target_type: "market_metric",
    is_relevant: true,
    region_code: regionCode,
    metric_key: metricKey,
    label: directText(input.mapped.label, 500),
    value,
    unit: directText(input.mapped.unit, 500),
    period_label: directText(input.mapped.period_label, 500),
    as_of_date: directDate(input.mapped.as_of_date),
    source_name: directText(input.mapped.source_name, 500),
    source_url: directUrl(input.mapped.source_url),
    notes: directText(input.mapped.notes),
    confidence: 1,
    evidence,
    warnings,
  };
}

function aiItems(input: {
  job: ImportJob;
  drafts: StructuredImportDraft[];
  provider: string;
  model: string;
  responseId: string;
  sourceText: string;
  sourceUrl: string | null;
  extractionWarnings: string[];
  pages?: PdfPageText[];
}): CreateImportItemInput[] {
  return input.drafts.map((rawDraft, index) => {
    const evidenceCheck = validateEvidenceLocations(
      input.job.input_type,
      rawDraft.evidence,
      {
        sourceText: input.sourceText,
        pages: input.pages,
      },
    );
    const warnings = [
      ...new Set([
        ...input.extractionWarnings,
        ...rawDraft.warnings,
        ...evidenceCheck.warnings,
      ]),
    ];
    const draft = {
      ...rawDraft,
      ...(rawDraft.target_type !== "unknown" &&
      !rawDraft.source_url &&
      input.job.input_type === "url"
        ? { source_url: input.sourceUrl }
        : {}),
      evidence: evidenceCheck.valid,
      warnings,
    } as StructuredImportDraft;
    const sourceLocation: JsonObject =
      input.job.input_type === "pdf"
        ? {
            pages: [...new Set(evidenceCheck.valid.flatMap((item) => item.page ?? []))],
          }
        : { url: input.sourceUrl };

    return {
      import_job_id: input.job.id,
      item_index: index + 1,
      target_type: draft.target_type,
      source_location: sourceLocation,
      sheet_name: null,
      source_row_number: null,
      source_part: 1,
      raw_row_hash: null,
      raw_data: jsonObject(rawDraft),
      extracted_text: null,
      ai_result: jsonObject(rawDraft),
      draft_data: jsonObject(draft),
      evidence: evidenceCheck.valid,
      confidence: draft.confidence,
      warnings,
      ai_provider: input.provider,
      ai_model: input.model,
      ai_response_id: input.responseId,
      prompt_version: IMPORT_PROMPT_VERSION,
      schema_version: IMPORT_SCHEMA_VERSION,
      review_status: "pending_review",
      reviewer_note: null,
      failure_stage: null,
      error_code: null,
      error_message: null,
    };
  });
}

function aiInputWarnings(sourceText: string): string[] {
  return sourceText.length > MAX_AI_INPUT_CHARS
    ? [`AI 输入超过 ${MAX_AI_INPUT_CHARS} 字符，仅发送前段内容，后续内容需人工核对`]
    : [];
}

export function formalDraftData(
  draft: StructuredImportDraft,
  regionId: string,
): JsonObject {
  if (draft.target_type === "unknown") {
    throw new ImportWorkflowError(
      "unknown 条目不能写入正式表",
      "UNKNOWN_TARGET_NOT_APPROVABLE",
    );
  }
  const omitted = new Set([
    "target_type",
    "is_relevant",
    "region_code",
    "confidence",
    "evidence",
    "warnings",
  ]);
  const fields = Object.fromEntries(
    Object.entries(draft).filter(([key]) => !omitted.has(key)),
  ) as JsonObject;
  return { region_id: regionId, ...fields };
}

export class ImportProcessingService {
  constructor(
    private readonly repository: SupabaseImportRepository,
    private readonly blobs: SupabaseImportBlobStore,
    private readonly regionRepository: RegionRepository,
    private readonly aiFactory: () => AiStructuredExtractor,
    private readonly urlFetcher = new SafeUrlFetcher(),
  ) {}

  async suggestMapping(input: {
    jobId: string;
    sheetName: string;
    targetType: "signal" | "market_metric";
    adminId: string;
  }) {
    const job = requireJob(await this.repository.getJob(input.jobId));
    if (job.input_type !== "excel") {
      throw new ImportWorkflowError(
        "只有 Excel/CSV 任务可以生成字段映射建议",
        "MAPPING_NOT_AVAILABLE",
      );
    }
    const preview = job.input_metadata.workbook_preview;
    const sheet = preview?.sheets.find((candidate) => candidate.name === input.sheetName);
    if (!sheet) {
      throw new ImportWorkflowError("工作表不存在", "SHEET_NOT_FOUND", 404);
    }
    const suggestion = await this.aiFactory().suggestMapping({
      sheet,
      targetType: input.targetType,
      adminId: input.adminId,
    });
    await this.repository.updateJob(job.id, {
      input_metadata: {
        ...job.input_metadata,
        mapping_suggestion: suggestion.data,
        mapping_ai: {
          provider: suggestion.provider,
          model: suggestion.model,
          response_id: suggestion.responseId,
          prompt_version: IMPORT_PROMPT_VERSION,
        },
      } as ImportJobMetadata,
    });
    return suggestion.data;
  }

  async process(
    jobId: string,
    adminId: string,
    options: ProcessOptions,
  ): Promise<ProcessResult> {
    const existing = requireJob(await this.repository.getJob(jobId));
    const existingItems = await this.repository.getItems(jobId);
    if (
      existingItems.length > 0 ||
      existing.duplicate_of_job_id ||
      ["review", "completed", "partial_failed"].includes(existing.status)
    ) {
      return { job: existing };
    }
    let claimed: ImportJob | null;
    if (existing.status === "processing") {
      const leaseStartedAt = existing.started_at ?? existing.updated_at;
      const leaseTimestamp = Date.parse(leaseStartedAt);
      if (
        !Number.isFinite(leaseTimestamp) ||
        Date.now() - leaseTimestamp <= PROCESSING_LEASE_MS
      ) {
        throw new ImportWorkflowError(
          "该导入任务正在处理中",
          "IMPORT_ALREADY_PROCESSING",
          409,
          true,
        );
      }
      claimed = await this.repository.reclaimStaleJob({
        id: jobId,
        expectedStartedAt: existing.started_at,
        retryCount: existing.retry_count + 1,
      });
    } else {
      claimed = await this.repository.claimJob(jobId);
    }
    if (!claimed) {
      throw new ImportWorkflowError(
        "该导入任务不能重复领取",
        "IMPORT_CLAIM_CONFLICT",
        409,
        true,
      );
    }
    if (existing.status === "failed") {
      await this.repository.updateJob(jobId, {
        retry_count: existing.retry_count + 1,
      });
    }

    let stage = "load_source";
    try {
      const regions = await this.regionRepository.list();
      if (claimed.input_type === "url") {
        return await this.processUrl(claimed, regions, adminId, () => {
          stage = "url_fetch_or_ai";
        });
      }
      if (claimed.input_type === "pdf") {
        return await this.processPdf(claimed, regions, adminId, () => {
          stage = "pdf_extract_or_ai";
        });
      }
      stage = "excel_convert";
      return await this.processExcel(claimed, regions, options);
    } catch (error) {
      const failure = failureDetails(error);
      await this.repository.updateJob(jobId, {
        status: "failed",
        failure_stage: stage,
        error_code: failure.code,
        error_message: failure.message.slice(0, 2_000),
        technical_error: technicalMessage(error),
        retryable: failure.retryable,
        completed_at: new Date().toISOString(),
      });
      throw new ImportWorkflowError(
        failure.message,
        failure.code,
        failure.status,
        failure.retryable,
      );
    }
  }

  private async processUrl(
    job: ImportJob,
    regions: Region[],
    adminId: string,
    started: () => void,
  ): Promise<ProcessResult> {
    started();
    if (!job.source_url) {
      throw new ImportWorkflowError("URL 任务缺少来源地址", "SOURCE_URL_MISSING");
    }
    let body: Uint8Array;
    let finalUrl: string;
    let redirectChain: string[];
    if (job.storage_path) {
      body = await this.blobs.download(job.storage_path);
      finalUrl =
        typeof job.input_metadata.fetched_url === "string"
          ? job.input_metadata.fetched_url
          : job.normalized_url ?? job.source_url;
      redirectChain = Array.isArray(job.input_metadata.redirect_chain)
        ? job.input_metadata.redirect_chain.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
    } else {
      const fetched = await this.urlFetcher.fetch(job.source_url);
      body = fetched.body;
      finalUrl = fetched.finalUrl;
      redirectChain = fetched.redirectChain;
    }
    const extracted = extractHtmlDocument(body, finalUrl);
    const extractionWarnings = [...extracted.warnings];
    const canonicalUrl =
      extracted.canonicalUrl && extracted.canonicalUrl.length <= 4_096
        ? extracted.canonicalUrl
        : null;
    if (extracted.canonicalUrl && !canonicalUrl) {
      extractionWarnings.push("canonical URL 过长，已忽略");
    }
    const inputName = extracted.title?.slice(0, 1_000) ?? job.input_name;
    if (extracted.title && extracted.title.length > 1_000) {
      extractionWarnings.push("网页标题超过 1000 字符，已截断");
    }
    if (!extracted.text.trim()) {
      throw new ImportWorkflowError(
        "网页未提取到可用正文",
        "HTML_TEXT_EMPTY",
      );
    }
    const contentHash = sha256(extracted.text);
    const duplicate = await this.repository.findContentDuplicate(
      "url",
      contentHash,
      job.id,
    );
    if (duplicate) {
      const updated = await this.repository.updateJob(job.id, {
        input_name: inputName,
        canonical_url: canonicalUrl ?? finalUrl,
        content_hash: contentHash,
        duplicate_of_job_id: duplicate.id,
        extracted_text: extracted.text,
        input_metadata: {
          ...job.input_metadata,
          fetched_url: finalUrl,
          redirect_chain: redirectChain,
          duplicate_reason: "content_hash",
        } as ImportJobMetadata,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      return { job: updated, duplicateOf: duplicate };
    }

    let storagePath = job.storage_path;
    if (!storagePath) {
      storagePath = importObjectPath({
        adminId,
        jobId: job.id,
        filename: "source.html",
      });
      await this.blobs.upload(storagePath, body, "text/html");
    }
    // Canonical metadata comes from untrusted page HTML. Keep it for
    // deduplication/audit, but only auto-fill the source link with the URL that
    // passed DNS checks and was actually fetched.
    const sourceUrl = finalUrl;
    const prepared = await this.repository.updateJob(job.id, {
      input_name: inputName,
      canonical_url: canonicalUrl ?? sourceUrl,
      storage_path: storagePath,
      source_mime_type: "text/html",
      original_size_bytes: body.byteLength,
      content_hash: contentHash,
      extracted_text: extracted.text,
      input_metadata: {
        ...job.input_metadata,
        published_at_hint: extracted.publishedAt?.slice(0, 100) ?? null,
        source_name_hint: extracted.sourceName?.slice(0, 500) ?? null,
        fetched_url: finalUrl,
        redirect_chain: redirectChain,
        attachment_urls: extracted.pdfAttachments as unknown as JsonValue[],
        extraction_warnings: extractionWarnings,
      } as ImportJobMetadata,
    });

    const result = await this.aiFactory().extract({
      inputType: "url",
      inputName: prepared.input_name,
      sourceUrl,
      extractedText: extracted.text,
      regions,
      adminId,
    });
    const items = aiItems({
      job: prepared,
      drafts: result.data.items,
      provider: result.provider,
      model: result.model,
      responseId: result.responseId,
      sourceText: extracted.text,
      sourceUrl,
      extractionWarnings: [
        ...extractionWarnings,
        ...result.data.warnings,
        ...aiInputWarnings(extracted.text),
      ],
    });
    await this.repository.updateJob(job.id, { total_items: items.length });
    await this.repository.createItems(items);
    return { job: requireJob(await this.repository.getJob(job.id)) };
  }

  private async processPdf(
    job: ImportJob,
    regions: Region[],
    adminId: string,
    started: () => void,
  ): Promise<ProcessResult> {
    started();
    if (!job.storage_path) {
      throw new ImportWorkflowError("PDF 原始文件不存在", "SOURCE_FILE_MISSING");
    }
    const bytes = await this.blobs.download(job.storage_path);
    const extracted = await extractPdfText(bytes, { maxBytes: 4 * 1024 * 1024 });
    if (extracted.likelyScanned) {
      throw new ImportWorkflowError(
        "当前 PDF 可能为扫描件，暂不支持 OCR",
        "PDF_OCR_REQUIRED",
      );
    }
    const contentHash = sha256(extracted.text);
    const prepared = await this.repository.updateJob(job.id, {
      content_hash: contentHash,
      extracted_text: extracted.text,
      input_metadata: {
        ...job.input_metadata,
        page_count: extracted.pageCount,
        extraction_warnings: extracted.warnings,
      } as ImportJobMetadata,
    });
    const result = await this.aiFactory().extract({
      inputType: "pdf",
      inputName: job.input_name,
      sourceUrl: null,
      extractedText: extracted.text,
      regions,
      adminId,
    });
    const items = aiItems({
      job: prepared,
      drafts: result.data.items,
      provider: result.provider,
      model: result.model,
      responseId: result.responseId,
      sourceText: extracted.text,
      sourceUrl: null,
      extractionWarnings: [
        ...extracted.warnings,
        ...result.data.warnings,
        ...aiInputWarnings(extracted.text),
      ],
      pages: extracted.pages,
    });
    await this.repository.updateJob(job.id, { total_items: items.length });
    await this.repository.createItems(items);
    return { job: requireJob(await this.repository.getJob(job.id)) };
  }

  private async processExcel(
    job: ImportJob,
    regions: Region[],
    options: ProcessOptions,
  ): Promise<ProcessResult> {
    if (!job.storage_path || !job.original_filename) {
      throw new ImportWorkflowError("工作簿原始文件不存在", "SOURCE_FILE_MISSING");
    }
    const sheetName = options.sheet_name ?? job.input_metadata.selected_sheet;
    const targetType =
      options.target_type ?? job.input_metadata.selected_target_type;
    const storedMapping = job.input_metadata.selected_mapping;
    const mapping =
      options.mapping ??
      (storedMapping && typeof storedMapping === "object" && !Array.isArray(storedMapping)
        ? Object.fromEntries(
            Object.entries(storedMapping).filter(
              (entry): entry is [string, string | null] =>
                typeof entry[1] === "string" || entry[1] === null,
            ),
          )
        : undefined);
    if (!sheetName || !targetType || !mapping) {
      throw new ImportWorkflowError(
        "必须先选择工作表、目标类型并确认字段映射",
        "EXCEL_MAPPING_REQUIRED",
      );
    }
    const withMapping = await this.repository.updateJob(job.id, {
      input_metadata: {
        ...job.input_metadata,
        selected_sheet: sheetName,
        selected_target_type: targetType,
        selected_mapping: mapping as JsonObject,
      } as ImportJobMetadata,
    });
    const bytes = await this.blobs.download(job.storage_path);
    const rows = await convertWorkbookRows(
      bytes,
      sheetName,
      mapping,
      { filename: job.original_filename, maxBytes: 4 * 1024 * 1024 },
    );
    if (!rows.length) {
      throw new ImportWorkflowError("工作表没有可导入的数据行", "EXCEL_ROWS_EMPTY");
    }

    const rowCandidates = rows.map((row) => ({
      row,
      rawRowHash: normalizedExcelRowHash(row.raw_data as JsonObject),
    }));
    const duplicates = await this.repository.findExcelRowDuplicates({
      currentJobId: job.id,
      targetType,
      sheetName,
      rows: rowCandidates.map(({ row, rawRowHash }) => ({
        source_row_number: row.row_number,
        raw_row_hash: rawRowHash,
        raw_data: row.raw_data as JsonObject,
      })),
    });
    const duplicateByIdentity = new Map(
      duplicates.map((duplicate) => [
        excelRowIdentityKey({
          sourceRowNumber: duplicate.requested_row_number,
          rawRowHash: duplicate.requested_raw_row_hash,
        }),
        duplicate,
      ]),
    );
    const newRows = rowCandidates.filter(
      ({ row, rawRowHash }) =>
        !duplicateByIdentity.has(
          excelRowIdentityKey({
            sourceRowNumber: row.row_number,
            rawRowHash,
          }),
        ),
    );
    const deduplication: ExcelRowDeduplicationMetadata = {
      version: "excel-row-v1",
      notice: duplicates.length
        ? `已跳过 ${duplicates.length} 行历史重复数据，未生成可批准草稿。`
        : "未发现同源工作簿的历史重复行。",
      source_key: job.workbook_source_key,
      source_row_count: rows.length,
      created_item_count: newRows.length,
      skipped_duplicate_count: duplicates.length,
      historical_job_ids: [...new Set(duplicates.map((item) => item.historical_job_id))],
      skipped_rows: duplicates.map((duplicate) => ({
        sheet_name: sheetName,
        source_row_number: duplicate.requested_row_number,
        target_type: targetType,
        raw_row_hash: duplicate.requested_raw_row_hash,
        historical_job_id: duplicate.historical_job_id,
        historical_item_id: duplicate.historical_item_id,
      })),
    };
    const prepared = await this.repository.updateJob(job.id, {
      total_items: newRows.length,
      input_metadata: {
        ...withMapping.input_metadata,
        excel_row_deduplication: deduplication,
      },
    });
    if (!newRows.length) {
      return {
        job: await this.repository.updateJob(job.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
        }),
      };
    }

    const items: CreateImportItemInput[] = newRows.map(({ row, rawRowHash }, index) => {
      const draft = excelDraft({
        targetType,
        mapped: row.mapped_data,
        raw: row.raw_data,
        sheet: sheetName,
        row: row.row_number,
        regions,
        rowWarnings: row.warnings,
      });
      const evidence = draft.evidence;
      return {
        import_job_id: prepared.id,
        item_index: index + 1,
        target_type: targetType,
        source_location: { sheet: sheetName, row: row.row_number },
        sheet_name: sheetName,
        source_row_number: row.row_number,
        source_part: 1,
        raw_row_hash: rawRowHash,
        raw_data: row.raw_data as JsonObject,
        extracted_text: JSON.stringify(row.raw_data),
        ai_result: jsonObject(draft),
        draft_data: jsonObject(draft),
        evidence,
        confidence: draft.confidence,
        warnings: draft.warnings,
        ai_provider: null,
        ai_model: null,
        ai_response_id: null,
        prompt_version: "deterministic-excel-mapping-v1",
        schema_version: IMPORT_SCHEMA_VERSION,
        review_status: "pending_review",
        reviewer_note: null,
        failure_stage: null,
        error_code: null,
        error_message: null,
      };
    });
    await this.repository.createItems(items);
    return { job: requireJob(await this.repository.getJob(job.id)) };
  }
}
