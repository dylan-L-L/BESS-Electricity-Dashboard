"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  DISPLAY_LOCALE_COOKIE,
  type DisplayLocale,
  isDisplayLocale,
} from "@/lib/i18n";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function setDisplayLocaleAction(locale: DisplayLocale) {
  if (!isDisplayLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set(DISPLAY_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
}
