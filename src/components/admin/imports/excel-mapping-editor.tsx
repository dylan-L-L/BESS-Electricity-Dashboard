"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { ExcelWorkbookPreview } from "@/lib/imports/types";

import styles from "./AdminImports.module.css";
import { formatCell, toExcelWorkbookView } from "./import-view-model";

type TargetType = "signal" | "market_metric";

type MappingField = {
  key: string;
  label: string;
  required?: boolean;
  hint: string;
};

const TARGET_FIELDS: Record<TargetType, MappingField[]> = {
  signal: [
    { key: "region_code", label: "地区", required: true, hint: "省份、国家或地区代码" },
    { key: "signal_type", label: "Signal 类型", hint: "policy / market" },
    { key: "title", label: "标题", required: true, hint: "政策或市场动态标题" },
    { key: "summary", label: "摘要", hint: "缺失时请在审核页人工补充，不会自动猜测" },
    { key: "normalized_status", label: "规范状态", hint: "draft / filed / approved / effective 等" },
    { key: "event_date", label: "事件日期", hint: "YYYY-MM-DD" },
    { key: "effective_date", label: "生效日期", hint: "缺失时必须保持为空" },
    { key: "source_url", label: "原文链接", hint: "http(s) URL" },
    { key: "source_name", label: "来源名称", hint: "机构或文件来源" },
    { key: "impact_direction", label: "影响方向", hint: "positive / negative / mixed" },
    { key: "impact_level", label: "影响级别", hint: "low / medium / high" },
  ],
  market_metric: [
    { key: "region_code", label: "地区", required: true, hint: "省份、国家或地区代码" },
    { key: "metric_key", label: "指标 Key", required: true, hint: "稳定的英文机器键" },
    { key: "label", label: "指标名称", required: true, hint: "例如峰谷价差" },
    { key: "value", label: "数值", required: true, hint: "缺失值不得映射为 0" },
    { key: "unit", label: "单位", required: true, hint: "有数值时不得缺失" },
    { key: "period_label", label: "期间", hint: "年、季度或日期" },
    { key: "as_of_date", label: "截至日期", hint: "YYYY-MM-DD" },
    { key: "source_url", label: "来源链接", hint: "http(s) URL" },
    { key: "source_name", label: "来源名称", hint: "文件或机构" },
  ],
};

type ApiPayload = {
  data?: unknown;
  mapping?: Record<string, string>;
  error?: { message?: string };
};

function mappingFromPayload(payload: ApiPayload): Record<string, string> {
  if (payload.mapping && typeof payload.mapping === "object") return payload.mapping;
  if (!payload.data || typeof payload.data !== "object") return {};
  const data = payload.data as Record<string, unknown>;
  const mapping = data.mapping ?? data.suggested_mapping ?? data.suggestedMapping;
  const mappings = data.mappings;
  if (Array.isArray(mappings)) {
    return Object.fromEntries(
      mappings.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const row = entry as Record<string, unknown>;
        return typeof row.target_field === "string" && typeof row.source_header === "string"
          ? [[row.target_field, row.source_header] as [string, string]]
          : [];
      }),
    );
  }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return {};
  return Object.fromEntries(
    Object.entries(mapping as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, value]),
  );
}

export function ExcelMappingEditor({
  jobId,
  preview,
}: {
  jobId: string;
  preview: ExcelWorkbookPreview;
}) {
  const router = useRouter();
  const workbook = useMemo(() => toExcelWorkbookView(preview), [preview]);
  const initialSheet = workbook.sheets.find((sheet) => !sheet.hidden) ?? workbook.sheets[0] ?? null;
  const [sheetName, setSheetName] = useState(initialSheet?.name ?? "");
  const [targetType, setTargetType] = useState<TargetType>("signal");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"suggest" | "process" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const activeSheet = workbook.sheets.find((sheet) => sheet.name === sheetName) ?? initialSheet;
  const fields = TARGET_FIELDS[targetType];
  const missingRequired = fields.filter((field) => field.required && !mapping[field.key]);

  function changeTarget(nextTarget: TargetType) {
    setTargetType(nextTarget);
    setMapping({});
    setFeedback(null);
  }

  async function suggestMapping() {
    if (!activeSheet) return;
    setBusy("suggest");
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/imports/${jobId}/suggest-mapping`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sheet_name: activeSheet.name, target_type: targetType }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(payload.error?.message ?? "无法生成字段映射建议。");
      const suggestion = mappingFromPayload(payload);
      setMapping((current) => ({ ...current, ...suggestion }));
      setFeedback({
        kind: "success",
        text: Object.keys(suggestion).length
          ? "已生成映射建议。请逐项确认后再生成草稿。"
          : "未找到可靠的自动映射，请手工选择表头。",
      });
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "建议映射失败。" });
    } finally {
      setBusy(null);
    }
  }

  async function processWorkbook() {
    if (!activeSheet) return;
    if (missingRequired.length) {
      setFeedback({ kind: "error", text: `请先完成必填映射：${missingRequired.map((field) => field.label).join("、")}。` });
      return;
    }

    setBusy("process");
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/imports/${jobId}/process`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sheet_name: activeSheet.name,
          target_type: targetType,
          mapping,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(payload.error?.message ?? "无法开始处理该工作表。");
      setFeedback({ kind: "success", text: "映射已确认，正在逐行生成待审核草稿。" });
      router.refresh();
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "处理失败。" });
    } finally {
      setBusy(null);
    }
  }

  if (!workbook.sheets.length) {
    return <div className="form-alert is-error">未读取到可预览的工作表。请查看任务错误或重新上传文件。</div>;
  }

  return (
    <section className={styles.mappingPanel} aria-labelledby="excel-mapping-title">
      <div className={styles.panelHeading}>
        <div>
          <span className="section-kicker">Workbook preview</span>
          <h2 id="excel-mapping-title">选择工作表并确认映射</h2>
        </div>
        <span className={styles.previewLimit}>仅预览前 20 行</span>
      </div>

      <ol className={styles.stepRail} aria-label="Excel 导入步骤">
        <li className={styles.stepDone}><span>✓</span>上传</li>
        <li className={styles.stepCurrent}><span>2</span>工作表</li>
        <li className={styles.stepCurrent}><span>3</span>表头映射</li>
        <li><span>4</span>生成草稿</li>
      </ol>

      <div className={styles.sheetTabs} role="tablist" aria-label="工作表">
        {workbook.sheets.map((sheet) => (
          <button
            key={sheet.name}
            type="button"
            role="tab"
            aria-selected={activeSheet?.name === sheet.name}
            className={activeSheet?.name === sheet.name ? styles.sheetTabActive : styles.sheetTab}
            onClick={() => {
              setSheetName(sheet.name);
              setMapping({});
              setFeedback(null);
            }}
          >
            {sheet.name}
            {sheet.hidden ? <span>隐藏</span> : null}
          </button>
        ))}
      </div>

      {activeSheet?.hidden ? (
        <div className="form-alert">当前是隐藏工作表。系统不会自动导入；只有继续确认映射才会处理该表。</div>
      ) : null}

      {activeSheet ? (
        <div className={styles.previewTableWrap} tabIndex={0} aria-label={`${activeSheet.name} 前 20 行预览`}>
          <table className={styles.previewTable}>
            <caption className="gl-sr-only">{activeSheet.name} 前 20 行预览</caption>
            <thead>
              <tr><th scope="col">行</th>{activeSheet.headers.map((header, index) => <th scope="col" key={`${header}-${index}`}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {activeSheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th scope="row">{activeSheet.rowNumbers[rowIndex] ?? rowIndex + 2}</th>
                  {row.map((cell, cellIndex) => <td key={cellIndex}>{formatCell(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {!activeSheet.rows.length ? <div className={styles.emptyPreview}>该工作表没有可预览的数据行。</div> : null}
        </div>
      ) : null}

      <div className={styles.mappingHeader}>
        <div>
          <span className="section-kicker">Target schema</span>
          <h3>导入目标</h3>
        </div>
        <div className={styles.targetSwitch} role="group" aria-label="导入目标">
          <button type="button" aria-pressed={targetType === "signal"} onClick={() => changeTarget("signal")}>Signal</button>
          <button type="button" aria-pressed={targetType === "market_metric"} onClick={() => changeTarget("market_metric")}>市场指标</button>
        </div>
      </div>

      <div className={styles.mappingGrid}>
        <div className={styles.mappingGridHead}><span>正式字段</span><span>Excel 列</span><span>状态</span></div>
        {fields.map((field) => (
          <div className={styles.mappingRow} key={field.key}>
            <div><strong>{field.label}{field.required ? " *" : ""}</strong><small>{field.hint}</small></div>
            <select
              aria-label={`${field.label} 对应 Excel 列`}
              value={mapping[field.key] ?? ""}
              onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
            >
              <option value="">不映射</option>
              {activeSheet?.headers.map((header, index) => <option value={header} key={`${header}-${index}`}>{header}</option>)}
            </select>
            <span className={mapping[field.key] ? styles.mappingReady : field.required ? styles.mappingMissing : styles.mappingOptional}>
              {mapping[field.key] ? "已确认" : field.required ? "必填缺失" : "可选"}
            </span>
          </div>
        ))}
      </div>

      {targetType === "market_metric" && !mapping.unit ? (
        <div className="form-alert">市场指标的数值必须有单位。未映射单位时不能生成可批准草稿。</div>
      ) : null}

      {feedback ? <div className={`form-alert ${feedback.kind === "error" ? "is-error" : "is-success"}`} role="status" aria-live="polite">{feedback.text}</div> : null}

      <div className={styles.mappingActions}>
        <button type="button" className="button" onClick={suggestMapping} disabled={Boolean(busy) || !activeSheet}>
          {busy === "suggest" ? "正在建议…" : "AI 建议映射"}
        </button>
        <button type="button" className="button primary" onClick={processWorkbook} disabled={Boolean(busy) || !activeSheet || Boolean(missingRequired.length)}>
          {busy === "process" ? "正在生成…" : "确认映射并生成草稿"}
        </button>
      </div>
    </section>
  );
}
