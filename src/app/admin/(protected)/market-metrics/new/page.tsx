import { AdminMetricForm } from "@/components/admin/admin-metric-form";
import { getAdminMetricData } from "@/lib/data/admin";

export default async function NewMetricPage() {
  const { regions } = await getAdminMetricData();
  return <><header className="admin-page-header"><div><span className="section-kicker">Market data</span><h1>新增市场指标</h1><p>没有数据时保持数值为空；不要填 0 代替缺失。</p></div></header><AdminMetricForm regions={regions} /></>;
}
