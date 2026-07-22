import styles from "./AdminImports.module.css";

const STATUS_LABELS: Record<string, string> = {
  pending: "等待处理",
  processing: "处理中",
  review: "待审核",
  completed: "已完成",
  partial_failed: "部分失败",
  failed: "失败",
  ai_draft: "AI 草稿",
  pending_review: "待审核",
  approved: "已批准",
  rejected: "已拒绝",
  import_failed: "导入失败",
};

const STATUS_TONES: Record<string, string> = {
  pending: styles.toneNeutral,
  processing: styles.toneProcessing,
  review: styles.toneReview,
  completed: styles.toneSuccess,
  partial_failed: styles.toneWarning,
  failed: styles.toneDanger,
  ai_draft: styles.toneNeutral,
  pending_review: styles.toneReview,
  approved: styles.toneSuccess,
  rejected: styles.toneDanger,
  import_failed: styles.toneDanger,
};

export function ImportStatusPill({ status }: { status: string }) {
  const normalized = status || "pending";
  return (
    <span className={`${styles.statusPill} ${STATUS_TONES[normalized] ?? styles.toneNeutral}`}>
      <span aria-hidden="true" />
      {STATUS_LABELS[normalized] ?? normalized}
    </span>
  );
}
export function importStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}
