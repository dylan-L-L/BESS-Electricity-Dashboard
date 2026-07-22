const STATUS_LABELS: Record<string, string> = {
  draft: "Draft / 草案",
  consultation: "Consultation / 征求意见",
  filed: "Filed / 已提交",
  approved: "Approved / 已批准",
  effective: "Effective / 已生效",
  suspended: "Suspended / 已暂停",
  other: "Other / 其他",
};

export function formatNullableNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("zh-CN", { maximumFractionDigits });
}

export function formatOptionalText(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized ? normalized : "—";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function normalizedStatusLabel(status: string | null | undefined): string {
  return status ? (STATUS_LABELS[status] ?? status) : "—";
}

export function statusClassName(status: string | null | undefined): string {
  const safeStatus = status?.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "other";
  return `gl-status-${safeStatus}`;
}
