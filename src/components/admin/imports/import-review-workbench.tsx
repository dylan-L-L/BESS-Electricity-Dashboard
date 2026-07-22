"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ImportItem, ImportJob } from "@/lib/imports/types";
import type { Region } from "@/lib/types";

import styles from "./AdminImports.module.css";
import { ImportDraftFields } from "./import-draft-fields";
import { ImportStatusPill } from "./import-status-pill";
import { SourcePreview } from "./source-preview";
import { type ReviewSourceView, toImportItemView, toImportJobView } from "./import-view-model";

type TargetType = "signal" | "market_metric" | "unknown";

type ApiPayload = {
  data?: unknown;
  error?: { message?: string; fields?: Record<string, string[]> };
};

const SIGNAL_FIELDS = [
  "target_type", "is_relevant", "region_code", "signal_type", "title", "summary", "category", "original_status",
  "normalized_status", "event_date", "effective_date", "impact_channel",
  "impact_direction", "impact_level", "source_url", "source_name", "confidence", "evidence", "warnings",
];

const METRIC_FIELDS = [
  "target_type", "is_relevant", "region_code", "metric_key", "label", "value", "unit", "period_label",
  "as_of_date", "source_url", "source_name", "notes", "confidence", "evidence", "warnings",
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function resolveRegionCode(draft: Record<string, unknown>, regions: Region[]) {
  const direct = text(draft.region_code);
  if (regions.some((region) => region.code === direct)) return direct;
  const candidate = text(draft.region_code ?? draft.region_id ?? draft.region).toLocaleLowerCase("zh-CN");
  if (!candidate) return "";
  return regions.find((region) =>
    [region.id, region.code, region.slug, region.name_zh, region.name_en]
      .filter(Boolean)
      .some((entry) => String(entry).toLocaleLowerCase("zh-CN") === candidate),
  )?.code ?? "";
}

function initializeDraft(source: Record<string, unknown>, targetType: TargetType, regions: Region[]) {
  const draft = { ...source };
  const regionCode = resolveRegionCode(draft, regions);
  if (regionCode) draft.region_code = regionCode;
  if (targetType !== "unknown") draft.target_type = targetType;
  if (typeof draft.is_relevant !== "boolean") draft.is_relevant = true;
  if (targetType === "signal" && !draft.signal_type) draft.signal_type = "policy";
  if (targetType === "market_metric") {
    if (!draft.label && draft.metric_name) draft.label = draft.metric_name;
    if (!draft.period_label && draft.period) draft.period_label = draft.period;
  }
  return draft;
}

function payloadDraft(targetType: TargetType, draft: Record<string, unknown>) {
  const fields = targetType === "signal" ? SIGNAL_FIELDS : METRIC_FIELDS;
  const output = Object.fromEntries(fields.map((field) => [field, draft[field] ?? null]));
  output.target_type = targetType;
  output.is_relevant = draft.is_relevant !== false;
  output.confidence = typeof draft.confidence === "number" && Number.isFinite(draft.confidence) ? draft.confidence : 0;
  output.evidence = Array.isArray(draft.evidence) ? draft.evidence : [];
  output.warnings = Array.isArray(draft.warnings) ? draft.warnings : [];
  if (targetType === "market_metric") {
    const rawValue = text(output.value);
    output.value = rawValue === "" ? null : Number(rawValue);
  }
  return output;
}

function apiError(payload: ApiPayload) {
  const fields = payload.error?.fields;
  if (fields && Object.keys(fields).length) {
    return Object.entries(fields).map(([field, messages]) => `${field}: ${messages.join("、")}`).join("；");
  }
  return payload.error?.message ?? "请求失败，请重试。";
}

function publicationBlockers(
  targetType: TargetType,
  draft: Record<string, unknown>,
  jobType: string,
  evidence: ReturnType<typeof toImportItemView>["evidence"],
  reviewerNote: string,
) {
  if (targetType === "unknown") return ["请先选择草稿类型"];
  const blockers: string[] = [];
  if (!text(draft.region_code)) blockers.push("地区未确认");
  if (draft.is_relevant === false) blockers.push("已标记为不相关记录");
  if (!reviewerNote.trim()) blockers.push("人工审核说明缺失");
  if (targetType === "signal") {
    if (!text(draft.title)) blockers.push("标题缺失");
    if (!text(draft.summary)) blockers.push("摘要缺失");
    if (!text(draft.normalized_status)) blockers.push("规范状态缺失");
    const sourceUrl = text(draft.source_url);
    if (!sourceUrl) blockers.push("原文链接缺失");
    else if (!/^https?:\/\//i.test(sourceUrl)) blockers.push("原文链接必须使用 http(s)");
  } else {
    if (!text(draft.metric_key)) blockers.push("指标 Key 缺失");
    if (!text(draft.label ?? draft.metric_name)) blockers.push("指标名称缺失");
    if (text(draft.value) === "") blockers.push("数值缺失");
    else if (!Number.isFinite(Number(text(draft.value)))) blockers.push("数值格式无效");
    if (!text(draft.unit)) blockers.push("单位缺失");
    if (!text(draft.source_url) && !text(draft.source_name)) blockers.push("指标来源缺失");
  }

  if (!evidence.length) blockers.push("没有可定位证据");
  if (jobType === "pdf" && !evidence.some((entry) => entry.page)) blockers.push("PDF 证据没有页码");
  if (jobType === "excel" && !evidence.some((entry) => entry.sheet && entry.row)) blockers.push("Excel 证据没有工作表和行号");
  return blockers;
}

export function ImportReviewWorkbench({
  job: rawJob,
  item: rawItem,
  items: rawItems,
  regions,
  sourcePreview,
}: {
  job: ImportJob;
  item: ImportItem;
  items: ImportItem[];
  regions: Region[];
  sourcePreview?: ReviewSourceView | null;
}) {
  const router = useRouter();
  const job = useMemo(() => toImportJobView(rawJob), [rawJob]);
  const item = useMemo(() => toImportItemView(rawItem), [rawItem]);
  const items = useMemo(() => rawItems.map(toImportItemView), [rawItems]);
  const initialTarget = item.targetType === "signal" || item.targetType === "market_metric" ? item.targetType : "unknown";
  const [targetType, setTargetType] = useState<TargetType>(initialTarget);
  const originalDraft = useMemo(
    () => initializeDraft({
      ...item.draftData,
      confidence: item.draftData.confidence ?? item.confidence ?? 0,
      evidence: item.draftData.evidence ?? item.raw.evidence ?? [],
      warnings: item.draftData.warnings ?? item.warnings,
    }, initialTarget, regions),
    [initialTarget, item, regions],
  );
  const [draft, setDraft] = useState<Record<string, unknown>>(originalDraft);
  const [reviewerNote, setReviewerNote] = useState(item.reviewerNote);
  const [selectedEvidence, setSelectedEvidence] = useState<number | null>(item.evidence.length ? 0 : null);
  const [busy, setBusy] = useState<"save" | "approve" | "reject" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const isTerminal = ["approved", "rejected", "import_failed"].includes(item.reviewStatus);
  const currentIndex = items.findIndex((entry) => entry.id === item.id);
  const previous = currentIndex > 0 ? items[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;
  const blockers = publicationBlockers(targetType, draft, job.inputType, item.evidence, reviewerNote);

  function updateDraft(field: string, value: unknown) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeTarget(nextTarget: TargetType) {
    setTargetType(nextTarget);
    setDraft((current) => initializeDraft(current, nextTarget, regions));
    setFeedback(null);
  }

  async function mutate(action: "save" | "approve" | "reject") {
    if (action !== "reject" && targetType === "unknown") {
      setFeedback({ kind: "error", text: "请先将 unknown 转换为 Signal 或 Market Metric。" });
      return;
    }
    if (action === "approve" && blockers.length) {
      setFeedback({ kind: "error", text: `当前不能批准：${blockers.join("；")}。` });
      return;
    }
    if (action === "reject" && !reviewerNote.trim()) {
      setFeedback({ kind: "error", text: "拒绝导入草稿时必须填写审核说明。" });
      return;
    }

    setBusy(action);
    setFeedback(null);
    try {
      const endpoint = action === "save"
        ? `/api/admin/import-items/${item.id}`
        : `/api/admin/import-items/${item.id}/${action}`;
      const body = action === "reject"
        ? { reviewer_note: reviewerNote.trim() }
        : {
            target_type: targetType,
            draft_data: payloadDraft(targetType, draft),
            reviewer_note: reviewerNote.trim(),
          };
      const response = await fetch(endpoint, {
        method: action === "save" ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(apiError(payload));
      setFeedback({
        kind: "success",
        text: action === "save"
          ? "审核进度已保存。"
          : action === "approve"
            ? targetType === "signal"
              ? "已批准并创建 Signal 草稿，尚未发布。"
              : "已批准并创建未公开的市场指标草稿。"
            : "该导入草稿已拒绝。",
      });
      router.refresh();
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "审核操作失败。" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.reviewShell}>
      <div className={styles.reviewToolbar}>
        <div className={styles.reviewIdentity}>
          <Link href={`/admin/imports/${job.id}`}>← 返回任务</Link>
          <span>{currentIndex >= 0 ? currentIndex + 1 : 1} / {items.length || 1}</span>
          <ImportStatusPill status={item.reviewStatus} />
        </div>
        <nav aria-label="切换导入条目" className={styles.itemPager}>
          {previous ? <Link href={`/admin/imports/${job.id}/review?item=${previous.id}`}>上一条</Link> : <span aria-disabled="true">上一条</span>}
          {next ? <Link href={`/admin/imports/${job.id}/review?item=${next.id}`}>下一条</Link> : <span aria-disabled="true">下一条</span>}
        </nav>
      </div>

      <div className={styles.reviewGrid}>
        <SourcePreview
          job={job}
          item={item}
          selectedEvidence={selectedEvidence}
          onSelectEvidence={setSelectedEvidence}
          reviewSource={sourcePreview}
        />

        <section className={styles.draftPane} aria-labelledby="draft-pane-title">
          <header className={styles.paneHeader}>
            <div>
              <span className="section-kicker">Human review gate</span>
              <h2 id="draft-pane-title">AI 草稿与人工修改</h2>
            </div>
            {item.confidence !== null ? (
              <div className={styles.confidence}><span>整体置信度</span><strong>{Math.round(item.confidence * 100)}%</strong></div>
            ) : null}
          </header>

          {item.warnings.length ? (
            <div className={styles.warningList} role="status">
              <strong>{item.warnings.length} 条待核对警告</strong>
              <ul>{item.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            </div>
          ) : null}

          {item.errorMessage ? (
            <div className="form-alert is-error" role="alert">
              <strong>导入失败{item.errorCode ? ` · ${item.errorCode}` : ""}：</strong>
              {item.errorMessage}
            </div>
          ) : null}

          <fieldset disabled={isTerminal} className={styles.reviewFormFieldset}>
          <div className={styles.targetBlock}>
            <span>草稿类型</span>
            <div className={styles.targetSwitch} role="group" aria-label="草稿类型">
              <button type="button" aria-pressed={targetType === "signal"} onClick={() => changeTarget("signal")}>Signal</button>
              <button type="button" aria-pressed={targetType === "market_metric"} onClick={() => changeTarget("market_metric")}>市场指标</button>
              <button type="button" aria-pressed={targetType === "unknown"} onClick={() => changeTarget("unknown")}>Unknown</button>
            </div>
          </div>

          {targetType === "unknown" ? (
            <div className={styles.unknownTarget}>
              <strong>AI 无法确定目标类型</strong>
              <p>请人工选择 Signal 或市场指标，然后核对必填字段与证据。</p>
            </div>
          ) : (
            <ImportDraftFields
              targetType={targetType}
              draft={draft}
              originalDraft={originalDraft}
              regions={regions}
              evidence={item.evidence}
              onChange={updateDraft}
              onEvidence={setSelectedEvidence}
            />
          )}

          <label className={styles.reviewerNote}>
            <span>审核说明</span>
            <textarea
              rows={4}
              value={reviewerNote}
              onChange={(event) => setReviewerNote(event.target.value)}
              placeholder="记录核对了哪些字段、修改理由或拒绝原因"
            />
          </label>
          </fieldset>

          {isTerminal ? (
            <div className={styles.readyNotice}>
              {item.reviewStatus === "approved"
                ? "该条目已经人工批准并写入正式草稿表，当前页面为只读记录。"
                : item.reviewStatus === "rejected"
                  ? "该条目已经人工拒绝，当前页面为只读记录。"
                  : "该条目在导入阶段失败，当前页面为只读记录。"}
              {item.reviewStatus === "approved" && item.approvedRecordId ? (
                <> <Link href={targetType === "market_metric" ? `/admin/market-metrics/${item.approvedRecordId}` : `/admin/signals/${item.approvedRecordId}`}>打开已创建的草稿 →</Link></>
              ) : null}
            </div>
          ) : blockers.length ? (
            <div className={styles.blockerList}>
              <strong>批准前需解决</strong>
              <ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
            </div>
          ) : (
            <div className={styles.readyNotice}>必填字段和证据定位已齐备。批准后只创建草稿，不会公开发布。</div>
          )}

          {feedback ? <div className={`form-alert ${feedback.kind === "error" ? "is-error" : "is-success"}`} role="status" aria-live="polite">{feedback.text}</div> : null}
        </section>
      </div>

      {!isTerminal ? <div className={styles.reviewActions}>
        <div><strong>人工审核门禁</strong><span>AI 不能直接写入已发布数据。</span></div>
        <div>
          <button type="button" className="button" disabled={Boolean(busy)} onClick={() => mutate("save")}>{busy === "save" ? "保存中…" : "保存审核进度"}</button>
          <button type="button" className="button danger" disabled={Boolean(busy)} onClick={() => mutate("reject")}>{busy === "reject" ? "拒绝中…" : "拒绝此条"}</button>
          <button type="button" className="button primary" disabled={Boolean(busy) || Boolean(blockers.length)} onClick={() => mutate("approve")}>
            {busy === "approve" ? "正在创建…" : targetType === "market_metric" ? "批准并创建指标草稿" : "批准并创建 Signal 草稿"}
          </button>
        </div>
      </div> : null}
    </div>
  );
}
