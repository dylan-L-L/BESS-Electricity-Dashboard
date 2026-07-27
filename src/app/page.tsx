import { Dashboard } from "@/components/public";
import { SetupRequired } from "@/components/system/setup-required";
import { getPublicDashboardData } from "@/lib/data/public";
import { getRequestDisplayLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q = "" }, data, locale] = await Promise.all([
    searchParams,
    getPublicDashboardData(),
    getRequestDisplayLocale(),
  ]);
  if (!data.configured) return <SetupRequired />;

  const globalRegion = data.regions.find((region) => region.region_type === "global");
  return (
    <Dashboard
      regions={data.regions}
      signals={data.signals}
      marketMetrics={data.marketMetrics}
      provinceTopics={data.provinceTopics}
      activeRegion={globalRegion}
      searchQuery={q}
      locale={locale}
    />
  );
}
