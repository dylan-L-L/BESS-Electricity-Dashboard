import type { Metadata } from "next";

import { getRequestDisplayLocale } from "@/lib/i18n/server";
import { localeTag } from "@/lib/i18n";

import "./globals.css";

export const metadata: Metadata = {
  title: "Grid Ledger — Policy & Market Intelligence",
  description: "人工审核发布的全球电力政策与市场动态看板",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestDisplayLocale();

  return (
    <html lang={localeTag(locale)}>
      <body>{children}</body>
    </html>
  );
}
