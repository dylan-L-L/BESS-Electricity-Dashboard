"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MarketMetric, Region } from "@/lib/types";

export function AdminMetricForm({ regions, metric }: { regions: Region[]; metric?: MarketMetric | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const data = new FormData(event.currentTarget);
    const rawValue = String(data.get("value") ?? "").trim();
    const payload = {
      region_id: String(data.get("region_id") ?? ""),
      metric_key: String(data.get("metric_key") ?? ""),
      label: String(data.get("label") ?? ""),
      value: rawValue === "" ? null : Number(rawValue),
      unit: String(data.get("unit") ?? ""),
      period_label: String(data.get("period_label") ?? ""),
      as_of_date: String(data.get("as_of_date") ?? ""),
      source_url: String(data.get("source_url") ?? ""),
      source_name: String(data.get("source_name") ?? ""),
      notes: String(data.get("notes") ?? ""),
      is_demo: data.get("is_demo") === "on",
      is_published: data.get("is_published") === "on",
    };

    try {
      const response = await fetch(metric ? `/api/admin/market-metrics/${metric.id}` : "/api/admin/market-metrics", {
        method: metric ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { data?: MarketMetric; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "保存失败");
      if (!metric) router.push(`/admin/market-metrics/${result.data.id}`);
      setFeedback("市场指标已保存。空值在公开页显示为 —，不会显示为 0。");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        <label><span>地区 *</span><select name="region_id" defaultValue={metric?.region_id ?? ""} required><option value="">请选择</option>{regions.map((region) => <option value={region.id} key={region.id}>{region.name_zh}</option>)}</select></label>
        <label><span>指标 Key *</span><input name="metric_key" defaultValue={metric?.metric_key ?? ""} placeholder="bess_installed_capacity" required /></label>
        <label className="span-2"><span>展示名称 *</span><input name="label" defaultValue={metric?.label ?? ""} required /></label>
        <label><span>数值（可空）</span><input name="value" type="number" step="any" defaultValue={metric?.value ?? ""} /></label>
        <label><span>单位</span><input name="unit" defaultValue={metric?.unit ?? ""} placeholder="GWh / % / ..." /></label>
        <label><span>期间</span><input name="period_label" defaultValue={metric?.period_label ?? ""} placeholder="2026 / 2026-Q3" /></label>
        <label><span>截至日期</span><input name="as_of_date" type="date" defaultValue={metric?.as_of_date?.slice(0, 10) ?? ""} /></label>
        <label className="span-2"><span>来源链接</span><input name="source_url" type="url" defaultValue={metric?.source_url ?? ""} /></label>
        <label><span>来源名称</span><input name="source_name" defaultValue={metric?.source_name ?? ""} /></label>
        <label className="span-2"><span>备注</span><textarea name="notes" rows={4} defaultValue={metric?.notes ?? ""} /></label>
        <label className="check-row"><input name="is_demo" type="checkbox" defaultChecked={metric?.is_demo ?? true} /><span>Demo</span></label>
        <label className="check-row"><input name="is_published" type="checkbox" defaultChecked={metric?.is_published ?? false} /><span>公开展示</span></label>
      </div>
      {feedback ? <div className="form-alert">{feedback}</div> : null}
      <div className="form-actions"><button type="submit" className="button primary" disabled={busy}>{busy ? "保存中…" : "保存市场指标"}</button></div>
    </form>
  );
}
