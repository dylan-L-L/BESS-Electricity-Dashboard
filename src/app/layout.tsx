import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grid Ledger — Policy & Market Intelligence",
  description: "人工审核发布的全球电力政策与市场动态看板",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
