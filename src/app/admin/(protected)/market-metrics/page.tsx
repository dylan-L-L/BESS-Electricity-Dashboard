import Link from "next/link";

import { getAdminMetricListData } from "@/lib/data/admin";
import { formatMetricValue } from "@/lib/domain/format";

export default async function AdminMetricsPage() {
  const { metrics, regions } = await getAdminMetricListData();
  const regionNames = new Map(regions.map((region) => [region.id, region.name_zh]));
  return <><header className="admin-page-header"><div><span className="section-kicker">Market metrics</span><h1>市场指标</h1></div><Link href="/admin/market-metrics/new" className="button primary">新增指标</Link></header><section className="admin-panel table-scroll"><table className="admin-table"><thead><tr><th>指标</th><th>地区</th><th>值</th><th>公开</th><th>Demo</th><th /></tr></thead><tbody>{metrics.map((metric) => <tr key={metric.id}><td><strong>{metric.label}</strong><small>{metric.metric_key}</small></td><td>{regionNames.get(metric.region_id) ?? "未知"}</td><td>{formatMetricValue(metric.value, metric.unit)}</td><td>{metric.is_published ? "是" : "否"}</td><td>{metric.is_demo ? "DEMO" : "—"}</td><td><Link href={`/admin/market-metrics/${metric.id}`}>编辑 →</Link></td></tr>)}</tbody></table>{!metrics.length ? <div className="admin-empty">暂无市场指标。</div> : null}</section></>;
}
