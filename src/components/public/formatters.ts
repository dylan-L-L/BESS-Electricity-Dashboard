import type { DisplayLocale } from "@/lib/i18n";
import { getMessages, localeTag } from "@/lib/i18n";

export function formatNullableNumber(
  value: number | null | undefined,
  maximumFractionDigits = 2,
  locale: DisplayLocale = "zh-CN",
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(localeTag(locale), { maximumFractionDigits });
}

export function formatOptionalText(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized ? normalized : "—";
}

export function formatDate(
  value: string | null | undefined,
  locale: DisplayLocale = "zh-CN",
): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function normalizedStatusLabel(
  status: string | null | undefined,
  locale: DisplayLocale = "zh-CN",
): string {
  if (!status) return "—";
  const labels = getMessages(locale).statusLabels;
  return labels[status] ?? status;
}

export function statusClassName(status: string | null | undefined): string {
  const safeStatus = status?.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "other";
  return `gl-status-${safeStatus}`;
}
