import { notFound } from "next/navigation";

import { Dashboard } from "@/components/public";
import { SetupRequired } from "@/components/system/setup-required";
import { getPublicDashboardData } from "@/lib/data/public";
import { getRequestDisplayLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function RegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ slug }, { q = "" }, data, locale] = await Promise.all([
    params,
    searchParams,
    getPublicDashboardData(),
    getRequestDisplayLocale(),
  ]);
  if (!data.configured) return <SetupRequired />;

  const region = data.regions.find((item) => item.slug === slug);
  if (!region || region.region_type === "global") notFound();

  return (
    <Dashboard
      regions={data.regions}
      signals={data.signals}
      marketMetrics={data.marketMetrics}
      provinceTopics={data.provinceTopics}
      activeRegion={region}
      searchQuery={q}
      locale={locale}
    />
  );
}
