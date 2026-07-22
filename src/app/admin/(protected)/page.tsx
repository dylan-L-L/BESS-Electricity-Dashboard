import Link from "next/link";

import { getAdminDashboardData } from "@/lib/data/admin";

export default async function AdminDashboardPage() {
  const { signals, metrics, regions } = await getAdminDashboardData();
  const published = signals.filter((signal) => signal.review_status === "published").length;
  const pending = signals.filter((signal) => signal.review_status === "pending_review").length;

  return (
    <>
      <header className="admin-page-header"><div><span className="section-kicker">Manual publishing workflow</span><h1>管理员工作台</h1></div><Link href="/admin/signals/new" className="button primary">新建 Signal</Link></header>
      <section className="admin-stat-grid">
        <article><span>待审核</span><strong>{pending}</strong></article>
        <article><span>已发布</span><strong>{published}</strong></article>
        <article><span>地区</span><strong>{regions.length}</strong></article>
        <article><span>市场指标</span><strong>{metrics.length}</strong></article>
      </section>
      <section className="admin-panel"><div className="admin-panel-header"><div><span className="section-kicker">Publishing gate</span><h2>发布检查</h2></div></div><p>发布必须具备地区、标题、摘要、原文链接、规范状态和人工确认信息。发布身份与时间由服务端写入，公开 API 仅查询 `published`。</p><div className="admin-quick-actions"><Link href="/admin/signals">打开 Signal 列表</Link><Link href="/admin/market-metrics">维护市场指标</Link></div></section>
    </>
  );
}
