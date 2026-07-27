import { cookies, headers } from "next/headers";

import {
  DEFAULT_DISPLAY_LOCALE,
  DISPLAY_LOCALE_COOKIE,
  type DisplayLocale,
  parseDisplayLocale,
} from "./locale";

/**
 * Resolve the public display language from cookie, then Accept-Language.
 */
export async function getRequestDisplayLocale(): Promise<DisplayLocale> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(DISPLAY_LOCALE_COOKIE)?.value;
  if (cookieValue) return parseDisplayLocale(cookieValue);

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  if (!acceptLanguage) return DEFAULT_DISPLAY_LOCALE;

  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.trim().split(";")[0])
    .find(Boolean);

  return preferred ? parseDisplayLocale(preferred) : DEFAULT_DISPLAY_LOCALE;
}
