import Link from "next/link";

import { getAdminSignalListData } from "@/lib/data/admin";
import { normalizedStatusLabel, reviewStatusLabel } from "@/lib/domain/status";

export default async function AdminSignalsPage() {
  const { signals, regions } = await getAdminSignalListData();
  const regionNames = new Map(regions.map((region) => [region.id, region.name_zh]));

  return (
    <>
      <header className="admin-page-header"><div><span className="section-kicker">Review queue</span><h1>Signals</h1></div><Link href="/admin/signals/new" className="button primary">新建 Signal</Link></header>
      <section className="admin-panel table-scroll"><table className="admin-table"><thead><tr><th>标题</th><th>地区</th><th>规范状态</th><th>审核状态</th><th>更新时间</th><th /></tr></thead><tbody>{signals.map((signal) => <tr key={signal.id}><td><strong>{signal.title || "未命名草稿"}</strong>{signal.is_demo ? <small>DEMO</small> : null}</td><td>{signal.region_id ? regionNames.get(signal.region_id) ?? "未知" : "—"}</td><td>{signal.normalized_status ? normalizedStatusLabel(signal.normalized_status) : "—"}</td><td>{reviewStatusLabel(signal.review_status)}</td><td>{new Date(signal.updated_at).toLocaleString("zh-CN")}</td><td><Link href={`/admin/signals/${signal.id}`}>编辑 →</Link></td></tr>)}</tbody></table>{!signals.length ? <div className="admin-empty">暂无 Signal。</div> : null}</section>
    </>
  );
}
