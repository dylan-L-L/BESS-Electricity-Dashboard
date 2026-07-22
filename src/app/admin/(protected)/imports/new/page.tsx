import Link from "next/link";

import { AdminImportNewForm } from "@/components/admin/imports/admin-import-new-form";

export default function NewImportPage() {
  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">Source intake</span>
          <h1>新建数据导入</h1>
          <p>原始内容、AI 结果与人工修改将分开保存，便于追溯到网页片段、PDF 页码或 Excel 行号。</p>
        </div>
        <Link href="/admin/imports" className="button">返回任务列表</Link>
      </header>
      <AdminImportNewForm />
    </>
  );
}
