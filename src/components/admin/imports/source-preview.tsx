"use client";

import type { EvidenceView, ImportItemView, ImportJobView, ReviewSourceView } from "./import-view-model";
import { formatCell } from "./import-view-model";
import styles from "./AdminImports.module.css";

function evidenceLocation(evidence: EvidenceView) {
  const parts = [
    evidence.location,
    evidence.page ? `PDF 第 ${evidence.page} 页` : null,
    evidence.sheet ? `工作表 ${evidence.sheet}` : null,
    evidence.row ? `第 ${evidence.row} 行` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "未标注位置";
}

function HighlightedText({ text, quote }: { text: string; quote?: string | null }) {
  if (!quote) return <>{text}</>;
  const index = text.toLocaleLowerCase("zh-CN").indexOf(quote.toLocaleLowerCase("zh-CN"));
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + quote.length)}</mark>
      {text.slice(index + quote.length)}
    </>
  );
}

function RawDataTable({ value }: { value: unknown }) {
  let normalized = value;
  if (typeof value === "string") {
    try {
      normalized = JSON.parse(value) as unknown;
    } catch {
      return <pre className={styles.rawPre}>{value}</pre>;
    }
  }

  if (!normalized || typeof normalized !== "object") {
    return <div className={styles.emptySource}>没有保存可展示的原始行数据。</div>;
  }

  const source = Array.isArray(normalized)
    ? Object.fromEntries(normalized.map((entry, index) => [`列 ${index + 1}`, entry]))
    : (normalized as Record<string, unknown>);

  return (
    <table className={styles.rawDataTable}>
      <caption className="gl-sr-only">导入条目的原始数据</caption>
      <tbody>
        {Object.entries(source).map(([key, entry]) => (
          <tr key={key}>
            <th scope="row">{key}</th>
            <td>{formatCell(entry)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SourcePreview({
  job,
  item,
  selectedEvidence,
  onSelectEvidence,
  reviewSource,
}: {
  job: ImportJobView;
  item: ImportItemView;
  selectedEvidence: number | null;
  onSelectEvidence: (index: number) => void;
  reviewSource?: ReviewSourceView | null;
}) {
  const evidence = selectedEvidence === null ? null : item.evidence[selectedEvidence] ?? null;
  const isExcel = job.inputType === "excel";

  return (
    <section className={styles.sourcePane} aria-labelledby="source-pane-title">
      <header className={styles.paneHeader}>
        <div>
          <span className="section-kicker">Immutable source</span>
          <h2 id="source-pane-title">原始来源与证据</h2>
        </div>
        {reviewSource?.signedUrl || reviewSource?.sourceUrl || job.sourceUrl ? (
          <a href={reviewSource?.signedUrl ?? reviewSource?.sourceUrl ?? job.sourceUrl ?? "#"} target="_blank" rel="noreferrer" className="button">
            {reviewSource?.signedUrl ? "打开原文件 ↗" : "打开原文 ↗"}
          </a>
        ) : null}
      </header>

      <div className={styles.sourceMeta}>
        <span>{job.inputType.toUpperCase()}</span>
        <strong>{item.sourceLocation ?? job.inputName}</strong>
      </div>

      <div className={styles.sourceDocument}>
        {isExcel ? (
          <RawDataTable value={item.rawData} />
        ) : item.extractedText || reviewSource?.text ? (
          <div className={styles.extractedText}>
            {evidence?.page ? <div className={styles.pageMarker}>PDF · 第 {evidence.page} 页</div> : null}
            <pre><HighlightedText text={item.extractedText ?? reviewSource?.text ?? ""} quote={evidence?.quote} /></pre>
          </div>
        ) : item.rawData ? (
          <RawDataTable value={item.rawData} />
        ) : (
          <div className={styles.emptySource}>没有可预览的提取文本。请根据 warning 与原始文件进行人工处理。</div>
        )}
      </div>

      <div className={styles.evidenceSection}>
        <div className={styles.evidenceHeading}>
          <h3>字段证据</h3>
          <span>{item.evidence.length} 条</span>
        </div>
        {item.evidence.length ? (
          <div className={styles.evidenceList}>
            {item.evidence.map((entry, index) => (
              <button
                type="button"
                key={`${entry.field ?? "field"}-${index}`}
                className={selectedEvidence === index ? styles.evidenceActive : styles.evidenceButton}
                onClick={() => onSelectEvidence(index)}
              >
                <span>{entry.field ?? "通用证据"}</span>
                <strong>{evidenceLocation(entry)}</strong>
                {entry.quote ? <q>{entry.quote}</q> : <small>没有保存原文摘录</small>}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.emptyEvidence}>暂无可定位证据。重要字段缺少证据时不应批准。</div>
        )}
      </div>
    </section>
  );
}
