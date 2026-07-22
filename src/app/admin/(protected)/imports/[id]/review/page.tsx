import { notFound } from "next/navigation";

import { ImportReviewWorkbench } from "@/components/admin/imports/import-review-workbench";
import { readImportReviewResult } from "@/components/admin/imports/import-view-model";
import { getImportReviewData } from "@/lib/data/imports";
import type { ImportItem } from "@/lib/imports/types";
import type { Region } from "@/lib/types";

export default async function ImportReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const result = readImportReviewResult(await getImportReviewData(id, query.item));
  if (!result.job) notFound();
  const item = result.item ?? result.items.find((entry) => !query.item || (entry as { id?: string }).id === query.item) ?? result.items[0];
  if (!item) notFound();

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">Evidence review</span>
          <h1>导入草稿审核</h1>
          <p>左侧核对原始证据，右侧修改 AI 字段。批准只会创建草稿，不会公开发布。</p>
        </div>
      </header>
      <ImportReviewWorkbench
        job={result.job}
        item={item as ImportItem}
        items={result.items.length ? result.items : [item as ImportItem]}
        regions={result.regions as Region[]}
        sourcePreview={result.sourcePreview}
      />
    </>
  );
}
