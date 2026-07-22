import type { Region } from "@/lib/types";

import {
  marketMetricImportDraftSchema,
  signalImportDraftSchema,
  structuredImportDraftSchema,
} from "@/lib/imports/schemas";
import type {
  ImportEvidence,
  ImportInputType,
  ImportTargetType,
  JsonObject,
  StructuredImportDraft,
} from "@/lib/imports/types";

export class ImportValidationError extends Error {
  readonly status = 422;
  readonly code = "IMPORT_NOT_APPROVABLE";

  constructor(
    message: string,
    readonly field_errors: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ImportValidationError";
  }
}

function normalizedEvidenceText(value: string): string {
  return value.replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
}

export function evidenceQuoteExists(quote: string, source: string): boolean {
  const needle = normalizedEvidenceText(quote);
  if (!needle) return false;
  return normalizedEvidenceText(source).includes(needle);
}

export function validateEvidenceLocations(
  inputType: ImportInputType,
  evidence: ImportEvidence[],
  options: {
    sourceText?: string | null;
    pages?: Array<{ page: number; text: string }>;
    sheetName?: string | null;
    rowNumber?: number | null;
  } = {},
): { valid: ImportEvidence[]; warnings: string[] } {
  const warnings: string[] = [];
  const valid = evidence.filter((item) => {
    if (inputType === "pdf") {
      if (!item.page) {
        warnings.push(`${item.field} 缺少 PDF 页码证据`);
        return false;
      }
      const page = options.pages?.find((candidate) => candidate.page === item.page);
      if (!page || !evidenceQuoteExists(item.quote, page.text)) {
        warnings.push(`${item.field} 的证据原文无法在 PDF 第 ${item.page} 页定位`);
        return false;
      }
      return true;
    }

    if (inputType === "excel") {
      const expectedSheet = options.sheetName;
      const expectedRow = options.rowNumber;
      if (!item.sheet || !item.row) {
        warnings.push(`${item.field} 缺少 Excel 工作表或行号`);
        return false;
      }
      if (
        (expectedSheet && item.sheet !== expectedSheet) ||
        (expectedRow && item.row !== expectedRow)
      ) {
        warnings.push(`${item.field} 的 Excel 证据位置与原始行不一致`);
        return false;
      }
      return true;
    }

    if (!options.sourceText || !evidenceQuoteExists(item.quote, options.sourceText)) {
      warnings.push(`${item.field} 的网页证据原文无法定位`);
      return false;
    }
    return true;
  });

  return { valid, warnings };
}

function addError(
  errors: Record<string, string[]>,
  field: string,
  message: string,
) {
  errors[field] = [...(errors[field] ?? []), message];
}

export function assertImportDraftApprovable(input: {
  inputType: ImportInputType;
  targetType: ImportTargetType;
  draftData: unknown;
  evidence: ImportEvidence[];
  sourceLocation: JsonObject;
  reviewerNote: string;
  regions: Array<Pick<Region, "code">>;
}): StructuredImportDraft {
  const errors: Record<string, string[]> = {};
  if (!input.reviewerNote.trim()) {
    addError(errors, "reviewer_note", "必须填写人工审核说明");
  }
  if (input.targetType === "unknown") {
    addError(errors, "target_type", "批准前必须选择 Signal 或 Market Metric");
  }

  const schema =
    input.targetType === "signal"
      ? signalImportDraftSchema
      : input.targetType === "market_metric"
        ? marketMetricImportDraftSchema
        : structuredImportDraftSchema;
  const parsed = schema.safeParse(input.draftData);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      addError(errors, issue.path.join(".") || "draft_data", issue.message);
    }
  }

  const draft = parsed.success ? parsed.data : null;
  if (draft && !draft.is_relevant) {
    addError(errors, "is_relevant", "不相关记录不能批准进入正式表");
  }

  if (draft && "region_code" in draft) {
    const knownRegion = input.regions.some(
      (region) => region.code && region.code === draft.region_code,
    );
    if (!draft.region_code || !knownRegion) {
      addError(errors, "region_code", "必须选择数据库中存在的地区代码");
    }
  }

  if (draft?.target_type === "signal") {
    if (!draft.title) addError(errors, "title", "Signal 标题不能为空");
    if (!draft.summary) addError(errors, "summary", "Signal 摘要不能为空");
    if (!draft.normalized_status) {
      addError(errors, "normalized_status", "必须人工确认规范状态");
    }
    if (!draft.source_url) {
      addError(
        errors,
        "source_url",
        "Signal 必须补充公开 HTTP(S) 原文链接；私有文件地址不能代替来源",
      );
    }
  }

  if (draft?.target_type === "market_metric") {
    if (!draft.metric_key) addError(errors, "metric_key", "指标 Key 不能为空");
    if (!draft.label) addError(errors, "label", "指标名称不能为空");
    if (draft.value === null) addError(errors, "value", "指标数值不能为空");
    if (!draft.unit) addError(errors, "unit", "有数值的指标必须填写原始单位");
    if (!draft.source_url && !draft.source_name) {
      addError(errors, "source", "指标至少需要来源链接或来源名称");
    }
  }

  if (!input.evidence.length) {
    addError(errors, "evidence", "批准前至少需要一条可定位证据");
  }
  if (
    input.inputType === "pdf" &&
    !input.evidence.some((item) => Number.isInteger(item.page) && (item.page ?? 0) > 0)
  ) {
    addError(errors, "evidence", "PDF 数据必须保留证据页码");
  }
  if (input.inputType === "excel") {
    const sheet = input.sourceLocation.sheet;
    const row = input.sourceLocation.row;
    if (typeof sheet !== "string" || !sheet || typeof row !== "number" || row < 1) {
      addError(errors, "source_location", "Excel 数据必须保留工作表和原始行号");
    }
  }

  if (Object.keys(errors).length || !draft) {
    throw new ImportValidationError("导入草稿尚不满足批准条件", errors);
  }
  return draft;
}
