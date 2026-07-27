import type {
  MarketMetric,
  NormalizedStatus,
  ProvinceTopicRecordWithFields,
  Region,
  Signal,
} from "@/lib/types";
import Link from "next/link";

import { type DisplayLocale, getMessages, regionDisplayName } from "@/lib/i18n";
import { compareContinents, compareCountries } from "@/lib/region-order";

import { ChinaProvinceMarketAtlas } from "./ChinaProvinceMarketAtlas";
import { GlobalMarketDirectory } from "./GlobalMarketDirectory";
import { LanguageSwitcher } from "./LanguageSwitcher";
import {
  formatDate,
  formatNullableNumber,
  formatOptionalText,
  normalizedStatusLabel,
  statusClassName,
} from "./formatters";

type RegionHref = (region: Region) => string;
type SignalHref = (signal: Signal) => string;

type DemoAware = { is_demo?: boolean };

export type PublishedSignal = Signal & {
  region_id: string;
  title: string;
  summary: string;
  source_url: string;
  normalized_status: NormalizedStatus;
  reviewer_note: string;
};

function isDemo(record: unknown): boolean {
  return Boolean((record as DemoAware | null)?.is_demo);
}

function defaultRegionHref(region: Region): string {
  return region.region_type === "global" ? "/" : `/regions/${region.slug}`;
}

function defaultSignalHref(signal: Signal): string {
  return `/signals/${signal.id}`;
}

function regionCode(region: Region): string {
  return region.code || region.name_en || region.region_type;
}

function descendantRegionIds(regions: Region[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const region of regions) {
      if (region.parent_id && ids.has(region.parent_id) && !ids.has(region.id)) {
        ids.add(region.id);
        changed = true;
      }
    }
  }

  return ids;
}

function scopedRegionIds(regions: Region[], activeRegion?: Region | null): Set<string> | null {
  if (!activeRegion || activeRegion.region_type === "global") return null;
  return descendantRegionIds(regions, activeRegion.id);
}

function byNewestSignal(left: Signal, right: Signal): number {
  const leftDate = left.event_date || left.published_at || left.created_at;
  const rightDate = right.event_date || right.published_at || right.created_at;
  return String(rightDate || "").localeCompare(String(leftDate || ""));
}

function matchesSearch(
  signal: PublishedSignal,
  query: string,
  regionsById: Map<string, Region>,
  locale: DisplayLocale,
): boolean {
  if (!query) return true;
  const region = regionsById.get(signal.region_id);
  const haystack = [
    signal.title,
    signal.summary,
    signal.category,
    signal.signal_type,
    signal.source_name,
    signal.original_status,
    signal.normalized_status,
    region?.name_zh,
    region?.name_en,
    region?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase(locale === "en" ? "en" : "zh-CN");

  return haystack.includes(query.toLocaleLowerCase(locale === "en" ? "en" : "zh-CN"));
}

export function isPublishedSignal(signal: Signal): signal is PublishedSignal {
  return (
    signal.review_status === "published" &&
    Boolean(signal.published_at) &&
    Boolean(signal.region_id?.trim()) &&
    Boolean(signal.title?.trim()) &&
    Boolean(signal.summary?.trim()) &&
    Boolean(signal.source_url?.trim()) &&
    Boolean(signal.normalized_status) &&
    Boolean(signal.reviewer_note?.trim())
  );
}

function publishedSignalsOnly(signals: Signal[]): PublishedSignal[] {
  return signals.filter(isPublishedSignal);
}

function publishedMetricsOnly(metrics: MarketMetric[]): MarketMetric[] {
  return metrics.filter((metric) => metric.is_published === true);
}

export interface RegionSelectorProps {
  regions: Region[];
  signals?: Signal[];
  activeRegionId?: string | null;
  allHref?: string;
  getRegionHref?: RegionHref;
  locale?: DisplayLocale;
}

export function RegionSelector({
  regions,
  signals = [],
  activeRegionId,
  allHref = "/",
  getRegionHref = defaultRegionHref,
  locale = "zh-CN",
}: RegionSelectorProps) {
  const copy = getMessages(locale).regionSelector;
  const unnamed = getMessages(locale).unnamedRegion;
  const regionName = (region?: Region) => regionDisplayName(region, locale, unnamed);
  const globalRegion = regions.find((region) => region.region_type === "global");
  const continents = regions
    .filter((region) => region.region_type === "continent")
    .sort(compareContinents);
  const countries = regions
    .filter((region) => region.region_type === "country")
    .sort(compareCountries);
  const provinces = regions.filter((region) => region.region_type === "province");
  const published = publishedSignalsOnly(signals);
  const realPublished = published.filter((signal) => !isDemo(signal));
  const demoPublished = published.filter(isDemo);
  const activeRegion = regions.find((region) => region.id === activeRegionId);
  const activeCountry =
    activeRegion?.region_type === "country"
      ? activeRegion
      : activeRegion?.region_type === "province"
        ? countries.find((country) => country.id === activeRegion.parent_id)
        : undefined;
  const activeCountryId = activeCountry?.id ?? null;
  const activeContinentId =
    activeRegion?.region_type === "continent"
      ? activeRegion.id
      : activeCountry?.parent_id ?? null;

  const countForRegion = (region: Region) => {
    const ids = descendantRegionIds(regions, region.id);
    return {
      real: realPublished.filter((signal) => ids.has(signal.region_id)).length,
      demo: demoPublished.filter((signal) => ids.has(signal.region_id)).length,
    };
  };
  const globalCounts = {
    real: realPublished.length,
    demo: demoPublished.length,
  };

  return (
    <nav className="gl-region-directory" aria-label={copy.label}>
      <div className="gl-directory-label">
        <span>{copy.areaDirectory}</span>
        <i aria-hidden="true" />
      </div>

      <a
        className={`gl-region-button ${
          !activeRegionId || activeRegionId === globalRegion?.id ? "is-active" : ""
        }`}
        href={globalRegion ? getRegionHref(globalRegion) : allHref}
        aria-current={!activeRegionId || activeRegionId === globalRegion?.id ? "page" : undefined}
        aria-label={copy.ariaCounts(
          globalRegion ? regionName(globalRegion) : copy.globalWatch,
          globalCounts.real,
          globalCounts.demo,
        )}
      >
        <span className="gl-region-dot" />
        <span>{globalRegion ? regionName(globalRegion) : copy.globalWatch}</span>
        <span className="gl-region-count">{String(globalCounts.real).padStart(2, "0")}</span>
      </a>

      <div className="gl-region-group">{copy.continents}</div>
      {continents.map((continent) => {
        const continentCounts = countForRegion(continent);
        const continentCountries = countries.filter(
          (country) => country.parent_id === continent.id,
        );
        const showCountries = activeContinentId === continent.id;
        return (
          <div className="gl-continent-cluster" key={continent.id}>
            <a
              className={`gl-region-button is-continent ${
                activeRegionId === continent.id ? "is-active" : ""
              }`}
              href={getRegionHref(continent)}
              aria-current={activeRegionId === continent.id ? "page" : undefined}
              aria-label={copy.ariaCounts(
                regionName(continent),
                continentCounts.real,
                continentCounts.demo,
              )}
              title={`${regionName(continent)} · Demo ${continentCounts.demo}`}
            >
              <span className="gl-region-dot" />
              <span>
                {regionName(continent)} <small>· {regionCode(continent)}</small>
              </span>
              <span className="gl-region-count">
                {String(continentCounts.real).padStart(2, "0")}
              </span>
            </a>
            {showCountries ? (
              <div className="gl-country-stack">
                {continentCountries.map((country) => {
                  const countryCounts = countForRegion(country);
                  const countryProvinces = provinces.filter(
                    (province) => province.parent_id === country.id,
                  );
                  const showProvinces = activeCountryId === country.id;
                  return (
                    <div className="gl-country-cluster" key={country.id}>
                      <a
                        className={`gl-region-button is-country ${
                          activeRegionId === country.id ? "is-active" : ""
                        }`}
                        href={getRegionHref(country)}
                        aria-current={activeRegionId === country.id ? "page" : undefined}
                        aria-label={copy.ariaCounts(
                          regionName(country),
                          countryCounts.real,
                          countryCounts.demo,
                        )}
                        title={`${regionName(country)} · Demo ${countryCounts.demo}`}
                      >
                        <span className="gl-region-dot" />
                        <span>
                          {regionName(country)} <small>· {regionCode(country)}</small>
                        </span>
                        <span className="gl-region-count">
                          {String(countryCounts.real).padStart(2, "0")}
                        </span>
                      </a>
                      {showProvinces
                        ? countryProvinces.map((province) => {
                            const provinceCounts = countForRegion(province);
                            return (
                              <a
                                className={`gl-region-button is-province ${
                                  activeRegionId === province.id ? "is-active" : ""
                                }`}
                                href={getRegionHref(province)}
                                aria-current={
                                  activeRegionId === province.id ? "page" : undefined
                                }
                                aria-label={copy.ariaCounts(
                                  regionName(province),
                                  provinceCounts.real,
                                  provinceCounts.demo,
                                )}
                                title={`${regionName(province)} · Demo ${provinceCounts.demo}`}
                                key={province.id}
                              >
                                <span className="gl-region-dot" />
                                <span>{regionName(province)}</span>
                                <span className="gl-region-count">
                                  {String(provinceCounts.real).padStart(2, "0")}
                                </span>
                              </a>
                            );
                          })
                        : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {countries.some((country) => !country.parent_id) ? (
        <>
          <div className="gl-region-group">{copy.unassignedCountries}</div>
          {countries
            .filter((country) => !country.parent_id)
            .map((country) => (
              <a
                className={`gl-region-button is-country ${
                  activeRegionId === country.id ? "is-active" : ""
                }`}
                href={getRegionHref(country)}
                aria-current={activeRegionId === country.id ? "page" : undefined}
                aria-label={regionName(country)}
                key={country.id}
              >
                <span className="gl-region-dot" />
                <span>{regionName(country)}</span>
                <span className="gl-region-count">
                  {String(countForRegion(country).real).padStart(2, "0")}
                </span>
              </a>
            ))}
        </>
      ) : null}

      {provinces.some((province) => !province.parent_id) ? (
        <>
          <div className="gl-region-group">{copy.provinces}</div>
          {provinces
            .filter((province) => !province.parent_id)
            .map((province) => (
              <a
                className={`gl-region-button ${activeRegionId === province.id ? "is-active" : ""}`}
                href={getRegionHref(province)}
                aria-current={activeRegionId === province.id ? "page" : undefined}
                aria-label={regionName(province)}
                key={province.id}
              >
                <span className="gl-region-dot" />
                <span>{regionName(province)}</span>
                <span className="gl-region-count">
                  {String(countForRegion(province).real).padStart(2, "0")}
                </span>
              </a>
            ))}
        </>
      ) : null}
    </nav>
  );
}

export interface SearchFormProps {
  defaultValue?: string;
  action?: string;
  locale?: DisplayLocale;
}

export function SearchForm({
  defaultValue = "",
  action = "/",
  locale = "zh-CN",
}: SearchFormProps) {
  const copy = getMessages(locale).search;
  return (
    <form className="gl-search-box" action={action} method="get" role="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label className="gl-sr-only" htmlFor="public-search">
        {copy.label}
      </label>
      <input
        id="public-search"
        name="q"
        type="search"
        placeholder={copy.placeholder}
        defaultValue={defaultValue}
        autoComplete="off"
      />
      <button type="submit">{copy.submit}</button>
    </form>
  );
}

export interface StatusPillProps {
  status: string | null | undefined;
  locale?: DisplayLocale;
}

export function StatusPill({ status, locale = "zh-CN" }: StatusPillProps) {
  return (
    <span className={`gl-status-pill ${statusClassName(status)}`} data-status={status || "other"}>
      {normalizedStatusLabel(status, locale)}
    </span>
  );
}

export interface SignalListProps {
  signals: Signal[];
  regions: Region[];
  getSignalHref?: SignalHref;
  locale?: DisplayLocale;
}

export function SignalList({
  signals,
  regions,
  getSignalHref = defaultSignalHref,
  locale = "zh-CN",
}: SignalListProps) {
  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const published = publishedSignalsOnly(signals);
  const unnamed = getMessages(locale).unnamedRegion;

  if (!published.length) {
    return <div className="gl-empty-state">{getMessages(locale).policy.empty}</div>;
  }

  return (
    <div className="gl-policy-feed">
      {published.map((signal) => {
        const region = regionsById.get(signal.region_id);
        return (
          <a className="gl-policy-item" href={getSignalHref(signal)} key={signal.id}>
            <div className="gl-policy-date">
              {formatDate(signal.event_date || signal.published_at, locale)}
              <strong>{regionDisplayName(region, locale, unnamed)}</strong>
            </div>
            <div className="gl-policy-content">
              <div className="gl-pill-row">
                <StatusPill status={signal.normalized_status} locale={locale} />
                {isDemo(signal) ? <span className="gl-demo-pill">Demo</span> : null}
              </div>
              <h3>{signal.title}</h3>
              <p>{signal.summary}</p>
              <div className="gl-policy-tags">
                {signal.category ? <span className="gl-policy-tag"># {signal.category}</span> : null}
                {signal.signal_type ? <span className="gl-policy-tag"># {signal.signal_type}</span> : null}
                {signal.impact_level ? <span className="gl-policy-tag"># IMPACT {signal.impact_level}</span> : null}
                {signal.source_name ? <span className="gl-policy-tag"># {signal.source_name}</span> : null}
              </div>
            </div>
            <span className="gl-policy-arrow" aria-hidden="true">
              →
            </span>
          </a>
        );
      })}
    </div>
  );
}

export interface MarketMetricsProps {
  metrics: MarketMetric[];
  regions: Region[];
  compact?: boolean;
  locale?: DisplayLocale;
}

export function MarketMetrics({
  metrics,
  regions,
  compact = false,
  locale = "zh-CN",
}: MarketMetricsProps) {
  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const published = publishedMetricsOnly(metrics);
  const copy = getMessages(locale);
  const unnamed = copy.unnamedRegion;

  if (!published.length) {
    return (
      <div className="gl-empty-state gl-empty-state-bordered">{copy.market.empty}</div>
    );
  }

  return (
    <div className={compact ? "gl-kpi-strip" : "gl-metric-grid"}>
      {published.map((metric) => {
        const value = formatNullableNumber(metric.value, 2, locale);
        const region = regionsById.get(metric.region_id);
        return (
          <article className={compact ? "gl-kpi" : "gl-metric-card"} key={metric.id}>
            <div className="gl-kpi-label">
              <i aria-hidden="true" />
              <span>{metric.label}</span>
              {metric.is_demo ? <span className="gl-demo-pill">Demo</span> : null}
            </div>
            <div className="gl-kpi-value">
              <strong>{value}</strong>
              {value !== "—" && metric.unit ? <span>{metric.unit}</span> : null}
            </div>
            <div className="gl-kpi-trend">
              {region ? `${regionDisplayName(region, locale, unnamed)} · ` : ""}
              {formatOptionalText(metric.period_label)}
            </div>
            {!compact ? (
              <div className="gl-metric-meta">
                <span>{copy.market.asOf(formatDate(metric.as_of_date, locale))}</span>
                <span>{formatOptionalText(metric.source_name)}</span>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

export interface DashboardProps {
  regions: Region[];
  signals: Signal[];
  marketMetrics: MarketMetric[];
  provinceTopics: ProvinceTopicRecordWithFields[];
  activeRegion?: Region | null;
  searchQuery?: string;
  searchAction?: string;
  getRegionHref?: RegionHref;
  getSignalHref?: SignalHref;
  locale?: DisplayLocale;
}

export function Dashboard({
  regions,
  signals,
  marketMetrics,
  provinceTopics,
  activeRegion,
  searchQuery = "",
  searchAction,
  getRegionHref = defaultRegionHref,
  getSignalHref = defaultSignalHref,
  locale = "zh-CN",
}: DashboardProps) {
  const copy = getMessages(locale);
  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const regionIds = scopedRegionIds(regions, activeRegion);
  const publishedSignals = publishedSignalsOnly(signals)
    .filter((signal) => !regionIds || regionIds.has(signal.region_id))
    .filter((signal) => matchesSearch(signal, searchQuery.trim(), regionsById, locale))
    .sort(byNewestSignal);
  const publishedMetrics = publishedMetricsOnly(marketMetrics).filter(
    (metric) => !regionIds || regionIds.has(metric.region_id),
  );
  const scopedProvinceTopics = provinceTopics.filter(
    (record) =>
      record.review_status === "published" &&
      record.published_at !== null &&
      (!regionIds || regionIds.has(record.region_id)),
  );
  const realPublishedSignals = publishedSignals.filter((signal) => !isDemo(signal));
  const demoPublishedSignals = publishedSignals.filter(isDemo);
  const realPublishedMetrics = publishedMetrics.filter((metric) => !metric.is_demo);
  const demoPublishedMetrics = publishedMetrics.filter((metric) => metric.is_demo);
  // Regions are structural seed/reference rows. A real Signal must never inherit
  // a Demo label only because its region was preloaded by the MVP seed.
  const hasDemoData =
    publishedSignals.some(isDemo) ||
    publishedMetrics.some((metric) => metric.is_demo) ||
    scopedProvinceTopics.some((record) => record.is_demo);
  const statusCount = (status: string) =>
    realPublishedSignals.filter((signal) => signal.normalized_status === status).length;
  const activeName = activeRegion
    ? regionDisplayName(activeRegion, locale, copy.unnamedRegion)
    : copy.regionSelector.globalWatch;
  const activeCode = activeRegion ? regionCode(activeRegion) : "GLOBAL WATCH";
  const topSignals = publishedSignals.slice(0, 3);
  const resolvedSearchAction = searchAction || (activeRegion ? getRegionHref(activeRegion) : "/");
  const chinaRegion = regions.find(
    (region) =>
      region.region_type === "country" &&
      (region.slug === "china" || region.code === "CN"),
  );
  const isChinaScope = Boolean(
    chinaRegion &&
      activeRegion &&
      (activeRegion.id === chinaRegion.id || activeRegion.parent_id === chinaRegion.id),
  );
  const isGlobalDirectoryScope = Boolean(
    !activeRegion ||
      activeRegion.region_type === "global" ||
      activeRegion.region_type === "continent",
  );
  const demoRecordCount =
    demoPublishedSignals.length +
    demoPublishedMetrics.length +
    scopedProvinceTopics.filter((record) => record.is_demo).length;

  return (
    <>
      {hasDemoData ? (
        <div className="gl-demo-ribbon" role="note">
          <span>Demo data</span> {copy.demoRibbon}
        </div>
      ) : null}

      <div className={`gl-app-shell ${hasDemoData ? "has-demo-ribbon" : ""}`}>
        <aside className="gl-sidebar" aria-label={copy.nav.sections}>
          <Link className="gl-brand" href="/" aria-label={copy.signalDetail.homeAria}>
            <div className="gl-brand-mark" aria-hidden="true" />
            <div className="gl-brand-copy">
              <strong>
                Grid
                <br />
                Ledger
              </strong>
              <span>{copy.brandTagline}</span>
            </div>
          </Link>

          <nav className="gl-primary-nav" aria-label={copy.nav.primary}>
            <a className="gl-nav-button is-active" href="#overview">
              <span className="gl-nav-index">01</span>
              <span>{copy.nav.overview}</span>
            </a>
            <a className="gl-nav-button" href="#market">
              <span className="gl-nav-index">02</span>
              <span>{copy.nav.market}</span>
            </a>
            <a className="gl-nav-button" href="#policy">
              <span className="gl-nav-index">03</span>
              <span>{copy.nav.policy}</span>
            </a>
            {isChinaScope ? (
              <a className="gl-nav-button" href="#china-market-atlas">
                <span className="gl-nav-index">04</span>
                <span>{copy.nav.provinceTopics}</span>
              </a>
            ) : isGlobalDirectoryScope ? (
              <a className="gl-nav-button" href="#global-market-directory">
                <span className="gl-nav-index">04</span>
                <span>{copy.nav.continentMarkets}</span>
              </a>
            ) : null}
          </nav>

          <RegionSelector
            regions={regions}
            signals={signals}
            activeRegionId={activeRegion?.id}
            getRegionHref={getRegionHref}
            locale={locale}
          />

          <div className="gl-sidebar-footer">
            <div className="gl-live-row">
              <span className="gl-live-dot" />
              <strong>{copy.sidebar.publishedRecords}</strong>
            </div>
            <span>{copy.sidebar.publishedOnly}</span>
          </div>
        </aside>

        <main className="gl-workspace" id="overview">
          <header className="gl-topbar">
            <div className="gl-breadcrumb">
              <span>{copy.topbar.dashboard}</span>
              <span>/</span>
              <strong>{activeName}</strong>
            </div>
            <SearchForm
              defaultValue={searchQuery}
              action={resolvedSearchAction}
              locale={locale}
            />
            <div className="gl-topbar-actions">
              <LanguageSwitcher locale={locale} />
              <a className="gl-view-button" href="/admin/login">
                {copy.topbar.admin}
              </a>
            </div>
          </header>

          <section className="gl-hero" data-index={activeRegion?.code || "01"}>
            <div className="gl-hero-copy">
              <div className="gl-eyebrow">{activeCode}</div>
              <h1>
                {activeRegion ? activeName : copy.hero.globalTitle}
                <br />
                <em>{activeRegion ? copy.hero.regionEm : copy.hero.globalEm}</em>
              </h1>
              <p className="gl-hero-description">{copy.hero.description}</p>
            </div>
            <div className="gl-hero-meta">
              <div className="gl-meta-row">
                <span>{copy.hero.realSignals}</span>
                <strong className="good">{realPublishedSignals.length}</strong>
              </div>
              <div className="gl-meta-row">
                <span>{copy.hero.realMetrics}</span>
                <strong>{realPublishedMetrics.length}</strong>
              </div>
              <div className="gl-meta-row">
                <span>{copy.hero.demoFixtures}</span>
                <strong>{demoRecordCount}</strong>
              </div>
            </div>
          </section>

          <div className="gl-mode-row">
            <nav className="gl-mode-switch" aria-label={copy.mode.label}>
              <a className="is-active" href="#overview">
                {copy.mode.combined}
              </a>
              <a href="#policy">{copy.mode.policy}</a>
              <a href="#market">{copy.mode.market}</a>
              {isChinaScope ? <a href="#china-market-atlas">{copy.mode.provinceTopics}</a> : null}
              {isGlobalDirectoryScope ? (
                <a href="#global-market-directory">{copy.mode.continentMarkets}</a>
              ) : null}
            </nav>
            <div className="gl-asof">{copy.mode.asOf}</div>
          </div>

          {isGlobalDirectoryScope ? (
            <GlobalMarketDirectory
              regions={regions}
              signals={signals}
              marketMetrics={marketMetrics}
              activeRegionId={activeRegion?.id}
              getRegionHref={getRegionHref}
              representativeCountryLimit={6}
              locale={locale}
            />
          ) : null}

          {isChinaScope && chinaRegion ? (
            <ChinaProvinceMarketAtlas
              regions={regions}
              chinaRegionId={chinaRegion.id}
              signals={signals}
              marketMetrics={marketMetrics}
              provinceTopics={provinceTopics}
              initialProvinceId={
                activeRegion?.region_type === "province" ? activeRegion.id : undefined
              }
              locale={locale}
            />
          ) : null}

          {topSignals.length ? (
            <section className="gl-signal-tape" aria-label={copy.policy.latest}>
              {topSignals.map((signal, index) => (
                <a className="gl-tape-item" href={getSignalHref(signal)} key={signal.id}>
                  <span className="gl-tape-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="gl-tape-copy">
                    <small>{normalizedStatusLabel(signal.normalized_status, locale)}</small>
                    <strong>{signal.title}</strong>
                  </span>
                </a>
              ))}
            </section>
          ) : null}

          <MarketMetrics
            metrics={publishedMetrics.slice(0, 4)}
            regions={regions}
            compact
            locale={locale}
          />

          <section className="gl-dashboard-grid" id="market">
            <article className="gl-panel gl-market-panel">
              <div className="gl-panel-header">
                <div>
                  <div className="gl-section-kicker">{copy.market.kicker}</div>
                  <h2>{copy.market.title}</h2>
                </div>
                <span className="gl-record-count">
                  {realPublishedMetrics.length} REAL · {demoPublishedMetrics.length} DEMO
                </span>
              </div>
              <MarketMetrics metrics={publishedMetrics} regions={regions} locale={locale} />
            </article>

            <aside className="gl-panel gl-signal-panel" aria-label={copy.status.title}>
              <div className="gl-panel-header">
                <div>
                  <div className="gl-section-kicker">{copy.status.kicker}</div>
                  <h2>{copy.status.title}</h2>
                </div>
              </div>
              <div className="gl-status-ledger">
                {(["filed", "approved", "draft", "effective"] as const).map((status) => (
                  <div className="gl-status-row" key={status}>
                    <StatusPill status={status} locale={locale} />
                    <strong>{statusCount(status)}</strong>
                  </div>
                ))}
              </div>
              <p className="gl-boundary-note">{copy.status.note}</p>
            </aside>
          </section>

          <section className="gl-panel gl-feed-panel" id="policy">
            <div className="gl-panel-header">
              <div>
                <div className="gl-section-kicker">{copy.policy.kicker}</div>
                <h2>{copy.policy.title}</h2>
              </div>
              <div className="gl-record-count">
                {String(realPublishedSignals.length).padStart(2, "0")} REAL ·{" "}
                {String(demoPublishedSignals.length).padStart(2, "0")} DEMO
              </div>
            </div>
            <SignalList
              signals={publishedSignals}
              regions={regions}
              getSignalHref={getSignalHref}
              locale={locale}
            />
          </section>
        </main>
      </div>
    </>
  );
}
