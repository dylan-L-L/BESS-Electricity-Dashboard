import { notFound } from "next/navigation";

import { AdminProvinceTopicForm } from "@/components/admin/admin-province-topic-form";
import { getAdminProvinceTopicData } from "@/lib/data/admin";

export default async function EditProvinceTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { regions, record } = await getAdminProvinceTopicData(id);
  if (!record) notFound();

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">{record.review_status}</span>
          <h1>编辑专题记录</h1>
          <p>{record.title || "未命名专题草稿"}</p>
        </div>
      </header>
      <AdminProvinceTopicForm regions={regions} record={record} />
    </>
  );
}
