"use client";

import type { Region } from "@/lib/types";
import { NORMALIZED_STATUSES, SIGNAL_TYPES } from "@/lib/types";
import { normalizedStatusLabel } from "@/lib/domain/status";

import type { EvidenceView } from "./import-view-model";
import styles from "./AdminImports.module.css";

type Draft = Record<string, unknown>;

function inputValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function sameValue(left: unknown, right: unknown) {
  return inputValue(left) === inputValue(right);
}

function FieldMeta({
  field,
  original,
  current,
  evidence,
  onEvidence,
}: {
  field: string;
  original: unknown;
  current: unknown;
  evidence: EvidenceView[];
  onEvidence: (index: number) => void;
}) {
  const evidenceIndex = evidence.findIndex((entry) => entry.field === field);
  const changed = !sameValue(original, current);
  if (!changed && evidenceIndex < 0) return null;
  return (
    <span className={styles.fieldMeta}>
      {changed ? <span className={styles.changedFlag}>已人工修改</span> : null}
      {evidenceIndex >= 0 ? (
        <button type="button" onClick={() => onEvidence(evidenceIndex)}>查看证据 {evidenceIndex + 1}</button>
      ) : null}
    </span>
  );
}

function FieldLabel({
  label,
  name,
  original,
  current,
  evidence,
  onEvidence,
  required,
}: {
  label: string;
  name: string;
  original: unknown;
  current: unknown;
  evidence: EvidenceView[];
  onEvidence: (index: number) => void;
  required?: boolean;
}) {
  return (
    <span className={styles.labelLine}>
      <span>{label}{required ? " *" : ""}</span>
      <FieldMeta field={name} original={original} current={current} evidence={evidence} onEvidence={onEvidence} />
    </span>
  );
}

export function ImportDraftFields({
  targetType,
  draft,
  originalDraft,
  regions,
  evidence,
  onChange,
  onEvidence,
}: {
  targetType: "signal" | "market_metric";
  draft: Draft;
  originalDraft: Draft;
  regions: Region[];
  evidence: EvidenceView[];
  onChange: (field: string, value: unknown) => void;
  onEvidence: (index: number) => void;
}) {
  const regionValue = inputValue(draft.region_code ?? draft.region);

  if (targetType === "market_metric") {
    return (
      <div className={styles.reviewFields}>
        <label className={styles.spanTwo}>
          <FieldLabel label="地区" name="region_code" required original={originalDraft.region_code} current={regionValue} evidence={evidence} onEvidence={onEvidence} />
          <select value={regionValue} onChange={(event) => onChange("region_code", event.target.value)} required>
            <option value="">请选择地区</option>
            {regions.filter((region) => region.code).map((region) => (
              <option key={region.id} value={region.code ?? ""}>{region.name_zh}{region.code ? ` · ${region.code}` : ""}</option>
            ))}
          </select>
        </label>
        <label>
          <FieldLabel label="指标 Key" name="metric_key" required original={originalDraft.metric_key} current={draft.metric_key} evidence={evidence} onEvidence={onEvidence} />
          <input value={inputValue(draft.metric_key)} onChange={(event) => onChange("metric_key", event.target.value)} placeholder="peak_valley_spread" />
        </label>
        <label>
          <FieldLabel label="展示名称" name="label" required original={originalDraft.label ?? originalDraft.metric_name} current={draft.label ?? draft.metric_name} evidence={evidence} onEvidence={onEvidence} />
          <input value={inputValue(draft.label ?? draft.metric_name)} onChange={(event) => onChange("label", event.target.value)} />
        </label>
        <label>
          <FieldLabel label="数值" name="value" required original={originalDraft.value} current={draft.value} evidence={evidence} onEvidence={onEvidence} />
          <input type="number" step="any" value={inputValue(draft.value)} onChange={(event) => onChange("value", event.target.value)} placeholder="缺失时保持为空" />
        </label>
        <label>
          <FieldLabel label="单位" name="unit" required original={originalDraft.unit} current={draft.unit} evidence={evidence} onEvidence={onEvidence} />
          <input value={inputValue(draft.unit)} onChange={(event) => onChange("unit", event.target.value)} placeholder="CNY/kWh / % / MW" />
        </label>
        <label>
          <FieldLabel label="期间" name="period_label" original={originalDraft.period_label ?? originalDraft.period} current={draft.period_label ?? draft.period} evidence={evidence} onEvidence={onEvidence} />
          <input value={inputValue(draft.period_label ?? draft.period)} onChange={(event) => onChange("period_label", event.target.value)} placeholder="2026 / 2026-Q3" />
        </label>
        <label>
          <FieldLabel label="截至日期" name="as_of_date" original={originalDraft.as_of_date} current={draft.as_of_date} evidence={evidence} onEvidence={onEvidence} />
          <input type="date" value={inputValue(draft.as_of_date).slice(0, 10)} onChange={(event) => onChange("as_of_date", event.target.value)} />
        </label>
        <label className={styles.spanTwo}>
          <FieldLabel label="来源链接" name="source_url" original={originalDraft.source_url} current={draft.source_url} evidence={evidence} onEvidence={onEvidence} />
          <input type="url" value={inputValue(draft.source_url)} onChange={(event) => onChange("source_url", event.target.value)} placeholder="https://..." />
        </label>
        <label>
          <FieldLabel label="来源名称" name="source_name" original={originalDraft.source_name} current={draft.source_name} evidence={evidence} onEvidence={onEvidence} />
          <input value={inputValue(draft.source_name)} onChange={(event) => onChange("source_name", event.target.value)} />
        </label>
        <label className={styles.spanTwo}>
          <FieldLabel label="备注" name="notes" original={originalDraft.notes} current={draft.notes} evidence={evidence} onEvidence={onEvidence} />
          <textarea rows={3} value={inputValue(draft.notes)} onChange={(event) => onChange("notes", event.target.value)} />
        </label>
      </div>
    );
  }

  return (
    <div className={styles.reviewFields}>
      <label>
        <FieldLabel label="地区" name="region_code" required original={originalDraft.region_code} current={regionValue} evidence={evidence} onEvidence={onEvidence} />
        <select value={regionValue} onChange={(event) => onChange("region_code", event.target.value)} required>
          <option value="">请选择地区</option>
          {regions.filter((region) => region.code).map((region) => (
            <option key={region.id} value={region.code ?? ""}>{region.name_zh}{region.code ? ` · ${region.code}` : ""}</option>
          ))}
        </select>
      </label>
      <label>
        <FieldLabel label="Signal 类型" name="signal_type" original={originalDraft.signal_type} current={draft.signal_type} evidence={evidence} onEvidence={onEvidence} />
        <select value={inputValue(draft.signal_type || "policy")} onChange={(event) => onChange("signal_type", event.target.value)}>
          {SIGNAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <label className={styles.spanTwo}>
        <FieldLabel label="标题" name="title" required original={originalDraft.title} current={draft.title} evidence={evidence} onEvidence={onEvidence} />
        <input value={inputValue(draft.title)} onChange={(event) => onChange("title", event.target.value)} />
      </label>
      <label className={styles.spanTwo}>
        <FieldLabel label="摘要" name="summary" required original={originalDraft.summary} current={draft.summary} evidence={evidence} onEvidence={onEvidence} />
        <textarea rows={5} value={inputValue(draft.summary)} onChange={(event) => onChange("summary", event.target.value)} />
      </label>
      <label>
        <FieldLabel label="分类" name="category" original={originalDraft.category} current={draft.category} evidence={evidence} onEvidence={onEvidence} />
        <input value={inputValue(draft.category)} onChange={(event) => onChange("category", event.target.value)} placeholder="现货市场 / 容量电价 / 绿电直连" />
      </label>
      <label>
        <FieldLabel label="原始状态" name="original_status" original={originalDraft.original_status} current={draft.original_status} evidence={evidence} onEvidence={onEvidence} />
        <input value={inputValue(draft.original_status)} onChange={(event) => onChange("original_status", event.target.value)} />
      </label>
      <label>
        <FieldLabel label="规范状态" name="normalized_status" required original={originalDraft.normalized_status} current={draft.normalized_status} evidence={evidence} onEvidence={onEvidence} />
        <select value={inputValue(draft.normalized_status)} onChange={(event) => onChange("normalized_status", event.target.value)}>
          <option value="">请选择</option>
          {NORMALIZED_STATUSES.map((status) => <option key={status} value={status}>{normalizedStatusLabel(status)}</option>)}
        </select>
      </label>
      <label>
        <FieldLabel label="事件日期" name="event_date" original={originalDraft.event_date} current={draft.event_date} evidence={evidence} onEvidence={onEvidence} />
        <input type="date" value={inputValue(draft.event_date).slice(0, 10)} onChange={(event) => onChange("event_date", event.target.value)} />
      </label>
      <label>
        <FieldLabel label="生效日期" name="effective_date" original={originalDraft.effective_date} current={draft.effective_date} evidence={evidence} onEvidence={onEvidence} />
        <input type="date" value={inputValue(draft.effective_date).slice(0, 10)} onChange={(event) => onChange("effective_date", event.target.value)} />
      </label>
      <label>
        <FieldLabel label="影响渠道" name="impact_channel" original={originalDraft.impact_channel} current={draft.impact_channel} evidence={evidence} onEvidence={onEvidence} />
        <input value={inputValue(draft.impact_channel)} onChange={(event) => onChange("impact_channel", event.target.value)} placeholder="收益 / 成本 / 需求 / 进度" />
      </label>
      <label>
        <FieldLabel label="影响方向" name="impact_direction" original={originalDraft.impact_direction} current={draft.impact_direction} evidence={evidence} onEvidence={onEvidence} />
        <select value={inputValue(draft.impact_direction)} onChange={(event) => onChange("impact_direction", event.target.value)}>
          <option value="">未判定</option><option value="positive">positive</option><option value="negative">negative</option><option value="mixed">mixed</option><option value="neutral">neutral</option>
        </select>
      </label>
      <label>
        <FieldLabel label="影响级别" name="impact_level" original={originalDraft.impact_level} current={draft.impact_level} evidence={evidence} onEvidence={onEvidence} />
        <select value={inputValue(draft.impact_level)} onChange={(event) => onChange("impact_level", event.target.value)}>
          <option value="">未判定</option><option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
        </select>
      </label>
      <label className={styles.spanTwo}>
        <FieldLabel label="原文链接" name="source_url" required original={originalDraft.source_url} current={draft.source_url} evidence={evidence} onEvidence={onEvidence} />
        <input type="url" value={inputValue(draft.source_url)} onChange={(event) => onChange("source_url", event.target.value)} placeholder="https://..." />
      </label>
      <label>
        <FieldLabel label="来源名称" name="source_name" original={originalDraft.source_name} current={draft.source_name} evidence={evidence} onEvidence={onEvidence} />
        <input value={inputValue(draft.source_name)} onChange={(event) => onChange("source_name", event.target.value)} />
      </label>
    </div>
  );
}
