import { notFound } from "next/navigation";

import { AdminSignalForm } from "@/components/admin/admin-signal-form";
import { getAdminSignalData } from "@/lib/data/admin";

export default async function EditSignalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { regions, signal } = await getAdminSignalData(id);
  if (!signal) notFound();
  return <><header className="admin-page-header"><div><span className="section-kicker">{signal.review_status}</span><h1>编辑 Signal</h1><p>{signal.title || "未命名草稿"}</p></div></header><AdminSignalForm regions={regions} signal={signal} /></>;
}
