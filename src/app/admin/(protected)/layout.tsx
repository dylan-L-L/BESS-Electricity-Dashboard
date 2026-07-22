import Link from "next/link";

import { logoutAction } from "@/app/admin/login/actions";
import { requireAdminPage } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="brand-lockup compact">
          <span className="brand-orbit" aria-hidden="true" />
          <div><strong>Grid Ledger</strong><span>ADMIN DESK</span></div>
        </Link>
        <nav aria-label="管理员导航">
          <Link href="/admin">工作台</Link>
          <Link href="/admin/signals">Signals</Link>
          <Link href="/admin/signals/new">新建 Signal</Link>
          <Link href="/admin/market-metrics">市场指标</Link>
          <Link href="/admin/imports">数据导入</Link>
          <Link href="/">公开看板 ↗</Link>
        </nav>
        <div className="admin-account">
          <span>{admin.email ?? admin.id}</span>
          <form action={logoutAction}><button type="submit" className="text-button">退出登录</button></form>
        </div>
      </aside>
      <main className="admin-workspace">{children}</main>
    </div>
  );
}
