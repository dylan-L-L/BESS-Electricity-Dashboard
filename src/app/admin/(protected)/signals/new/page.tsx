import { AdminSignalForm } from "@/components/admin/admin-signal-form";
import { getAdminSignalData } from "@/lib/data/admin";

export default async function NewSignalPage() {
  const { regions } = await getAdminSignalData();
  return <><header className="admin-page-header"><div><span className="section-kicker">Manual intake</span><h1>新建 Signal</h1><p>可先保存不完整草稿；只有满足发布门槛后才可公开。</p></div></header><AdminSignalForm regions={regions} /></>;
}
