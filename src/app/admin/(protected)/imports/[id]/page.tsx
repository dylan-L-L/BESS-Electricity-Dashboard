import Link from "next/link";
import { notFound } from "next/navigation";

import { ExcelMappingEditor } from "@/components/admin/imports/excel-mapping-editor";
import { ImportJobProgress } from "@/components/admin/imports/import-job-progress";
import { RetryImportButton } from "@/components/admin/imports/retry-import-button";
import { ImportStatusPill } from "@/components/admin/imports/import-status-pill";
import {
  formatDateTime,
  readImportJobResult,
  toImportItemView,
  toImportJobView,
} from "@/components/admin/imports/import-view-model";
import styles from "@/components/admin/imports/AdminImports.module.css";
import { getImportJobData } from "@/lib/data/imports";

export default async function ImportJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const { id } = await params;
  const duplicateNotice = (await searchParams).duplicate === "1";
  const result = readImportJobResult(await getImportJobData(id));
  if (!result.job) notFound();
  const job = toImportJobView(result.job);
  const items = result.items.map(toImportItemView);
  const reviewable = items.find((item) => item.reviewStatus === "ai_draft" || item.reviewStatus === "pending_review");
  const approvedCount = items.filter((item) => item.reviewStatus === "approved").length;
  const rejectedCount = items.filter((item) => item.reviewStatus === "rejected").length;
  const warningCount = items.reduce((total, item) => total + item.warnings.length, 0);
  const showMapping = job.inputType === "excel" && result.workbookPreview && !items.length && ["pending", "review", "failed"].includes(job.status);
  const rowDeduplication = result.job.input_metadata.excel_row_deduplication;

  return (
    <>
      <header className="admin-page-header">
        <div>
          <span className="section-kicker">Import job · {job.inputType}</span>
          <h1>导入任务详情</h1>
          <p>{job.inputName}</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/admin/imports" className="button">返回列表</Link>
          {((result.job.status === "failed" && result.job.retryable) || result.job.status === "processing") ? (
            <RetryImportButton jobId={result.job.id} />
          ) : null}
          {reviewable ? <Link href={`/admin/imports/${job.id}/review?item=${reviewable.id}`} className="button primary">开始人工审核</Link> : null}
        </div>
      </header>

      <section className={styles.jobSummary}>
        <div className={styles.jobLead}>
          <div><span>当前状态</span><ImportStatusPill status={job.status} /></div>
          <h2>{job.inputName}</h2>
          {job.sourceUrl ? <a href={job.sourceUrl} target="_blank" rel="noreferrer">{job.sourceUrl} ↗</a> : null}
          {job.fileHash ? <code>SHA-256 · {job.fileHash}</code> : null}
        </div>
        <dl className={styles.jobMetaGrid}>
          <div><dt>创建时间</dt><dd>{formatDateTime(job.createdAt)}</dd></div>
          <div><dt>开始处理</dt><dd>{formatDateTime(job.startedAt)}</dd></div>
          <div><dt>完成时间</dt><dd>{formatDateTime(job.completedAt)}</dd></div>
          <div><dt>输入类型</dt><dd>{job.inputType.toUpperCase()}</dd></div>
        </dl>
      </section>

      <ImportJobProgress status={job.status} />

      {duplicateNotice || result.job.duplicate_of_job_id ? (
        <div className="form-alert" role="status">
          <strong>该内容此前已导入，系统没有重复生成草稿。</strong>{" "}
          {result.job.duplicate_of_job_id ? (
            <Link href={`/admin/imports/${result.job.duplicate_of_job_id}`}>查看首次导入任务 →</Link>
          ) : (
            <span>当前展示的是已有任务。</span>
          )}
        </div>
      ) : null}

      {rowDeduplication && rowDeduplication.skipped_duplicate_count > 0 ? (
        <div className="form-alert" role="status">
          <strong>{rowDeduplication.notice}</strong>{" "}
          <span>
            历史任务：{rowDeduplication.historical_job_ids.slice(0, 5).map((historyJobId, index) => (
              <span key={historyJobId}>
                {index ? "、" : ""}
                <Link href={`/admin/imports/${historyJobId}`}>{historyJobId.slice(0, 8)}</Link>
              </span>
            ))}
            {rowDeduplication.historical_job_ids.length > 5
              ? ` 等 ${rowDeduplication.historical_job_ids.length} 个`
              : null}
          </span>
        </div>
      ) : null}

      {job.errorMessage ? (
        <div className="form-alert is-error" role="alert"><strong>任务未能完整处理：</strong>{job.errorMessage}</div>
      ) : null}

      {showMapping && result.workbookPreview ? <ExcelMappingEditor jobId={job.id} preview={result.workbookPreview} /> : null}

      <section className={styles.itemPanel}>
        <div className={styles.panelHeading}>
          <div><span className="section-kicker">Review inventory</span><h2>导入条目</h2></div>
          <div className={styles.itemCounts}>
            <span>全部 <strong>{items.length}</strong></span>
            <span>已批准 <strong>{approvedCount}</strong></span>
            <span>已拒绝 <strong>{rejectedCount}</strong></span>
            <span>Warnings <strong>{warningCount}</strong></span>
          </div>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.importTable}>
            <thead><tr><th>来源位置</th><th>目标</th><th>置信度</th><th>Warnings</th><th>审核状态</th><th><span className="gl-sr-only">操作</span></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.sourceLocation ?? `条目 ${item.id.slice(0, 8)}`}</strong>
                    <small>
                      {item.approvedRecordId
                        ? `已写入 · ${item.approvedRecordId}`
                        : item.errorMessage
                          ? `${item.errorCode ? `${item.errorCode} · ` : ""}${item.errorMessage}`
                          : item.id}
                    </small>
                  </td>
                  <td><span className={styles.typeTag}>{item.targetType}</span></td>
                  <td>{item.confidence === null ? "—" : `${Math.round(item.confidence * 100)}%`}</td>
                  <td className={item.warnings.length ? styles.countFailed : undefined}>{item.warnings.length}</td>
                  <td><ImportStatusPill status={item.reviewStatus} /></td>
                  <td><Link href={`/admin/imports/${job.id}/review?item=${item.id}`}>{item.reviewStatus === "import_failed" ? "查看失败原因" : item.reviewStatus === "approved" || item.reviewStatus === "rejected" ? "查看记录" : "审核"} →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && !showMapping ? (
            <div className={styles.emptyList}>
              <strong>{job.status === "failed" ? "未生成可审核条目" : "尚未生成导入条目"}</strong>
              <p>{job.status === "failed" ? "请根据上方错误信息检查原始输入。" : "处理完成后，AI 草稿会出现在这里。"}</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
