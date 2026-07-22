"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import styles from "./AdminImports.module.css";

export function ImportJobProgress({ status }: { status: string }) {
  const router = useRouter();
  const running = status === "pending" || status === "processing";

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [router, running]);

  if (!running) return null;

  return (
    <div className={styles.processingNotice} role="status" aria-live="polite">
      <span className={styles.processingMark} aria-hidden="true" />
      <div>
        <strong>{status === "pending" ? "任务待处理" : "正在提取并生成草稿"}</strong>
        <p>此页会自动更新。若处理请求中断，任务会记录失败阶段并允许重新发起。</p>
      </div>
    </div>
  );
}
