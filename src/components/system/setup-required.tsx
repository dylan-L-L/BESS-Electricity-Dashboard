import Link from "next/link";

export function SetupRequired() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="status-pill status-draft">SETUP REQUIRED</span>
        <h1>Grid Ledger 已构建，等待数据库连接</h1>
        <p>请复制 <code>.env.example</code> 为 <code>.env.local</code>，填写 Supabase URL 与 Publishable Key，再执行数据库迁移。</p>
        <div className="code-block">npm run db:start{"\n"}npm run db:reset{"\n"}npm run dev</div>
        <Link href="/admin/login" className="button primary">管理员登录</Link>
      </section>
    </main>
  );
}
