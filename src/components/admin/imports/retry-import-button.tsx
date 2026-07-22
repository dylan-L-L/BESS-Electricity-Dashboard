"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryImportButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/imports/${jobId}/process`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "重新处理失败");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "重新处理失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="button" onClick={retry} disabled={busy}>
        {busy ? "正在重试…" : "重新处理"}
      </button>
      {error ? <span className="form-alert is-error" role="alert">{error}</span> : null}
    </div>
  );
}
