import type { Region } from "@/lib/types";

export const DISPLAY_LOCALES = ["zh-CN", "en"] as const;

export type DisplayLocale = (typeof DISPLAY_LOCALES)[number];

export const DEFAULT_DISPLAY_LOCALE: DisplayLocale = "zh-CN";

/** Cookie that stores the visitor's public UI display language. */
export const DISPLAY_LOCALE_COOKIE = "gl_display_lang";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isDisplayLocale(value: unknown): value is DisplayLocale {
  return value === "zh-CN" || value === "en";
}

export function parseDisplayLocale(value: string | null | undefined): DisplayLocale {
  if (!value) return DEFAULT_DISPLAY_LOCALE;
  const normalized = value.trim();
  if (isDisplayLocale(normalized)) return normalized;
  const lower = normalized.toLowerCase();
  if (lower === "zh" || lower.startsWith("zh-")) return "zh-CN";
  if (lower === "en" || lower.startsWith("en-")) return "en";
  return DEFAULT_DISPLAY_LOCALE;
}

export function localeTag(locale: DisplayLocale): string {
  return locale === "en" ? "en" : "zh-CN";
}

export function displayLocaleCookie(locale: DisplayLocale): string {
  return `${DISPLAY_LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * Prefer the name that matches the active display language, then fall back.
 */
export function regionDisplayName(
  region: Pick<Region, "name_zh" | "name_en" | "code" | "slug"> | null | undefined,
  locale: DisplayLocale,
  fallback = "",
): string {
  if (!region) return fallback;
  if (locale === "en") {
    return region.name_en || region.name_zh || region.code || region.slug || fallback;
  }
  return region.name_zh || region.name_en || region.code || region.slug || fallback;
}
