"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import styles from "./AdminImports.module.css";

type ImportMode = "url" | "pdf" | "excel";

type ApiPayload = {
  data?: unknown;
  error?: { message?: string; fields?: Record<string, string[]> };
};

const MODE_COPY: Record<ImportMode, { eyebrow: string; title: string; description: string }> = {
  url: {
    eyebrow: "Single public page",
    title: "导入网页 URL",
    description: "仅读取当前公开页面，不登录网站、不绕过付费墙，不扩展爬取其他链接。",
  },
  pdf: {
    eyebrow: "Text PDF only",
    title: "上传 PDF",
    description: "第一版仅支持可提取文字的 PDF。扫描件会标记为需要人工处理，不会让 AI 猜测。",
  },
  excel: {
    eyebrow: "Workbook intake",
    title: "上传 Excel / CSV",
    description: "文件上传后先查看工作表和前 20 行，确认映射后才生成导入草稿。",
  },
};

function apiError(payload: ApiPayload) {
  const fields = payload.error?.fields;
  if (fields && Object.keys(fields).length) {
    return Object.entries(fields)
      .map(([field, messages]) => `${field}: ${messages.join("、")}`)
      .join("；");
  }
  return payload.error?.message ?? "无法创建导入任务，请稍后重试。";
}

function responseId(payload: ApiPayload): string | null {
  const data = payload.data;
  if (!data || typeof data !== "object") return null;
  const source = data as Record<string, unknown>;
  if (typeof source.id === "string") return source.id;
  const job = source.job;
  if (job && typeof job === "object" && typeof (job as Record<string, unknown>).id === "string") {
    return (job as Record<string, string>).id;
  }
  return null;
}

function isDuplicate(payload: ApiPayload): boolean {
  const data = payload.data;
  if (!data || typeof data !== "object") return false;
  const source = data as Record<string, unknown>;
  if (source.duplicate === true || source.duplicateOf) return true;
  const job = source.job;
  return Boolean(
    job &&
      typeof job === "object" &&
      (job as Record<string, unknown>).duplicate_of_job_id,
  );
}

function fileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminImportNewForm() {
  const router = useRouter();
  const fileInputId = useId();
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const copy = MODE_COPY[mode];

  function changeMode(nextMode: ImportMode) {
    if (busy) return;
    setMode(nextMode);
    setFile(null);
    setFeedback(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      let response: Response;
      if (mode === "url") {
        response = await fetch("/api/admin/imports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input_type: "url", source_url: url.trim() }),
        });
      } else {
        if (!file) throw new Error("请先选择要上传的文件。");
        const body = new FormData();
        body.set("input_type", mode);
        body.set("file", file);
        response = await fetch("/api/admin/imports", { method: "POST", body });
      }

      const payload = (await response.json().catch(() => ({}))) as ApiPayload;
      if (!response.ok) throw new Error(apiError(payload));
      const id = responseId(payload);
      if (!id) throw new Error("任务已提交，但服务器未返回任务编号。");
      let duplicate = isDuplicate(payload);

      if (mode !== "excel") {
        const processResponse = await fetch(`/api/admin/imports/${id}/process`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const processPayload = (await processResponse.json().catch(() => ({}))) as ApiPayload;
        if (!processResponse.ok) {
          router.push(`/admin/imports/${id}`);
          router.refresh();
          throw new Error(`${apiError(processPayload)}（任务已保存，可在详情页查看）`);
        }
        duplicate = duplicate || isDuplicate(processPayload);
      }

      setFeedback({ kind: "success", text: "导入任务已创建，正在打开任务详情。" });
      router.push(`/admin/imports/${id}${duplicate ? "?duplicate=1" : ""}`);
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "创建任务失败。",
      });
    } finally {
      setBusy(false);
    }
  }

  const accept = mode === "pdf" ? ".pdf,application/pdf" : ".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return (
    <section className={styles.intakePanel}>
      <div className={styles.modeTabs} role="tablist" aria-label="选择导入方式">
        {(["url", "pdf", "excel"] as const).map((entry, index) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={mode === entry}
            className={mode === entry ? styles.modeTabActive : styles.modeTab}
            onClick={() => changeMode(entry)}
          >
            <span>0{index + 1}</span>
            {entry === "url" ? "网页 URL" : entry === "pdf" ? "PDF 文件" : "Excel / CSV"}
          </button>
        ))}
      </div>

      <form className={styles.intakeBody} onSubmit={submit}>
        <div className={styles.intakeCopy}>
          <span className="section-kicker">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>

        {mode === "url" ? (
          <label className={styles.fieldLabel}>
            <span>公开网页地址</span>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.gov/policy/article"
              required
              disabled={busy}
            />
          </label>
        ) : (
          <div>
            <label className={styles.uploadZone} htmlFor={fileInputId}>
              <input
                id={fileInputId}
                type="file"
                accept={accept}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                disabled={busy}
              />
              <span className={styles.uploadGlyph} aria-hidden="true">+</span>
              <strong>{file ? file.name : `选择${mode === "pdf" ? " PDF" : " Excel / CSV"} 文件`}</strong>
              <small>{file ? fileSize(file.size) : "点击选择文件；上传后将进行真实类型与大小校验"}</small>
            </label>
          </div>
        )}

        {mode === "excel" ? (
          <ol className={styles.stepRail} aria-label="Excel 导入步骤">
            <li className={styles.stepCurrent}><span>1</span>上传</li>
            <li><span>2</span>工作表</li>
            <li><span>3</span>表头映射</li>
            <li><span>4</span>生成草稿</li>
          </ol>
        ) : null}

        <div className={styles.boundaryNote}>
          <strong>安全边界</strong>
          <span>原始输入由服务端校验和保存；AI 只生成待审核草稿，不能自动发布或覆盖正式数据。</span>
        </div>

        {feedback ? (
          <div
            className={`form-alert ${feedback.kind === "error" ? "is-error" : "is-success"}`}
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </div>
        ) : null}

        <div className={styles.intakeActions}>
          <button
            type="submit"
            className="button primary"
            disabled={busy || (mode === "url" ? !url.trim() : !file)}
          >
            {busy ? "正在创建…" : mode === "excel" ? "上传并预览" : "读取并生成草稿"}
          </button>
        </div>
      </form>
    </section>
  );
}
