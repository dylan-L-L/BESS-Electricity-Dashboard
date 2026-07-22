import { notFound } from "next/navigation";

import { AdminMetricForm } from "@/components/admin/admin-metric-form";
import { getAdminMetricData } from "@/lib/data/admin";

export default async function EditMetricPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { regions, metric } = await getAdminMetricData(id);
  if (!metric) notFound();
  return <><header className="admin-page-header"><div><span className="section-kicker">Market data</span><h1>编辑市场指标</h1><p>{metric.label}</p></div></header><AdminMetricForm regions={regions} metric={metric} /></>;
}
