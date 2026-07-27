"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { type DisplayLocale, DISPLAY_LOCALES, getMessages } from "@/lib/i18n";
import { setDisplayLocaleAction } from "@/lib/i18n/actions";

export interface LanguageSwitcherProps {
  locale: DisplayLocale;
  className?: string;
}

export function LanguageSwitcher({ locale, className }: LanguageSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const copy = getMessages(locale).languageSwitcher;

  function selectLocale(next: DisplayLocale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setDisplayLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div
      className={["gl-lang-switch", className].filter(Boolean).join(" ")}
      role="group"
      aria-label={copy.label}
      data-pending={pending ? "true" : undefined}
    >
      {DISPLAY_LOCALES.map((option) => {
        const selected = option === locale;
        const label = option === "zh-CN" ? copy.zh : copy.en;
        return (
          <button
            type="button"
            key={option}
            className={selected ? "is-active" : undefined}
            aria-pressed={selected}
            disabled={pending}
            onClick={() => selectLocale(option)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
