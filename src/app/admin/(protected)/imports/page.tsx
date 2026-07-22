import Link from "next/link";

import { ImportStatusPill } from "@/components/admin/imports/import-status-pill";
import {
  formatDateTime,
  readImportJobsResult,
  toImportJobView,
} from "@/components/admin/imports/import-view-model";
import styles from "@/components/admin/imports/AdminImports.module.css";
import { getImportJobsData } from "@/lib/data/imports";

export default async function AdminImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const [result, query] = await Promise.all([getImportJobsData(), searchParams]);
  const jobs = readImportJobsResult(result).map(toImportJobView);
  const q = query.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const visibleJobs = jobs.filter((job) => {
    if (query.status && job.status !== query.status) return false;
    if (query.type && job.inputType !== query.type) return false;
    if (!q) return true;
    return [job.inputName, job.originalFilename, job.sourceUrl, job.fileHash]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase("zh-CN").includes(q));
  });
  const reviewCount = jobs.filter((job) => job.status === "review").length;
  const processingCount = jobs.filter((job) => job.status === "pending" || job.status === "processing").length;
  const failedCount = jobs.filter((job) => job.status === "failed" || job.status === "partial_failed").length;

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">AI-assisted intake</span>
          <h1>数据导入</h1>
          <p>网页、PDF 与 Excel 只生成待审核草稿。人工批准后写入正式表，仍不会自动发布。</p>
        </div>
        <Link href="/admin/imports/new" className="button primary">新建导入</Link>
      </header>

      <section className={styles.importStats} aria-label="导入任务统计">
        <article><span>待审核</span><strong>{reviewCount}</strong></article>
        <article><span>处理中</span><strong>{processingCount}</strong></article>
        <article><span>失败 / 部分失败</span><strong>{failedCount}</strong></article>
        <article><span>全部任务</span><strong>{jobs.length}</strong></article>
      </section>

      <section className={styles.listPanel}>
        <form className={styles.filterBar} method="get">
          <label>
            <span className="gl-sr-only">搜索导入任务</span>
            <input name="q" type="search" defaultValue={query.q ?? ""} placeholder="搜索文件名、URL 或哈希" />
          </label>
          <select name="type" defaultValue={query.type ?? ""} aria-label="输入类型">
            <option value="">全部输入</option>
            <option value="url">网页 URL</option>
            <option value="pdf">PDF</option>
            <option value="excel">Excel / CSV</option>
          </select>
          <select name="status" defaultValue={query.status ?? ""} aria-label="任务状态">
            <option value="">全部状态</option>
            <option value="pending">等待处理</option>
            <option value="processing">处理中</option>
            <option value="review">待审核</option>
            <option value="completed">已完成</option>
            <option value="partial_failed">部分失败</option>
            <option value="failed">失败</option>
          </select>
          <button type="submit" className="button">筛选</button>
          {(query.q || query.type || query.status) ? <Link href="/admin/imports" className={styles.clearFilter}>清除</Link> : null}
        </form>

        <div className={styles.tableScroll}>
          <table className={styles.importTable}>
            <thead><tr><th>输入</th><th>类型</th><th>状态</th><th>条目</th><th>成功 / 失败</th><th>创建时间</th><th><span className="gl-sr-only">操作</span></th></tr></thead>
            <tbody>
              {visibleJobs.map((job) => (
                <tr key={job.id}>
                  <td><strong>{job.inputName}</strong><small>{job.sourceUrl ?? (job.fileHash ? `HASH · ${job.fileHash.slice(0, 16)}…` : job.id)}</small></td>
                  <td><span className={styles.typeTag}>{job.inputType}</span></td>
                  <td><ImportStatusPill status={job.status} /></td>
                  <td>{job.totalItems || "—"}</td>
                  <td><span className={styles.countSuccess}>{job.successfulItems}</span><span aria-hidden="true"> / </span><span className={job.failedItems ? styles.countFailed : undefined}>{job.failedItems}</span></td>
                  <td>{formatDateTime(job.createdAt)}</td>
                  <td><Link href={`/admin/imports/${job.id}`}>查看 →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleJobs.length ? (
            <div className={styles.emptyList}>
              <strong>{jobs.length ? "没有匹配的导入任务" : "还没有导入任务"}</strong>
              <p>{jobs.length ? "调整搜索或筛选条件后重试。" : "从单篇网页、PDF 或 Excel 创建第一个 AI 待审核草稿。"}</p>
              {!jobs.length ? <Link href="/admin/imports/new" className="button primary">新建导入</Link> : null}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
