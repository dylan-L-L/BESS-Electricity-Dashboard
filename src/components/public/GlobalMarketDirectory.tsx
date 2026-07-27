import type { MarketMetric, Region, Signal } from "@/lib/types";
import { type DisplayLocale, getMessages, regionDisplayName } from "@/lib/i18n";
import { compareContinents, compareCountries } from "@/lib/region-order";

import styles from "./GlobalMarketDirectory.module.css";

export type GlobalDirectoryRegion = Region;

type RecordCounts = {
  realSignals: number;
  realMetrics: number;
  demoSignals: number;
  demoMetrics: number;
};

const EMPTY_COUNTS: RecordCounts = {
  realSignals: 0,
  realMetrics: 0,
  demoSignals: 0,
  demoMetrics: 0,
};

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function defaultRegionHref(region: GlobalDirectoryRegion): string {
  return region.region_type === "global" ? "/" : `/regions/${region.slug}`;
}

function descendantIds(
  rootId: string,
  regions: readonly GlobalDirectoryRegion[],
): Set<string> {
  const ids = new Set<string>([rootId]);
  let foundNewRegion = true;

  while (foundNewRegion) {
    foundNewRegion = false;
    for (const region of regions) {
      if (region.parent_id && ids.has(region.parent_id) && !ids.has(region.id)) {
        ids.add(region.id);
        foundNewRegion = true;
      }
    }
  }

  return ids;
}

function countPublishedRecords(
  region: GlobalDirectoryRegion,
  regions: readonly GlobalDirectoryRegion[],
  signals: readonly Signal[],
  metrics: readonly MarketMetric[],
): RecordCounts {
  const ids = descendantIds(region.id, regions);
  const counts = { ...EMPTY_COUNTS };

  for (const signal of signals) {
    if (
      signal.review_status !== "published" ||
      !signal.published_at ||
      !signal.region_id ||
      !ids.has(signal.region_id)
    ) {
      continue;
    }
    if (signal.is_demo) counts.demoSignals += 1;
    else counts.realSignals += 1;
  }

  for (const metric of metrics) {
    if (!metric.is_published || !ids.has(metric.region_id)) continue;
    if (metric.is_demo) counts.demoMetrics += 1;
    else counts.realMetrics += 1;
  }

  return counts;
}

function realRecordCount(counts: RecordCounts): number {
  return counts.realSignals + counts.realMetrics;
}

function demoRecordCount(counts: RecordCounts): number {
  return counts.demoSignals + counts.demoMetrics;
}

function availabilityState(counts: RecordCounts): "available" | "demo-only" | "no-data" {
  if (realRecordCount(counts) > 0) return "available";
  if (demoRecordCount(counts) > 0) return "demo-only";
  return "no-data";
}

function addCounts(left: RecordCounts, right: RecordCounts): RecordCounts {
  return {
    realSignals: left.realSignals + right.realSignals,
    realMetrics: left.realMetrics + right.realMetrics,
    demoSignals: left.demoSignals + right.demoSignals,
    demoMetrics: left.demoMetrics + right.demoMetrics,
  };
}

export interface GlobalMarketDirectoryProps {
  /** Continents and countries are derived exclusively from these region rows. */
  regions: readonly GlobalDirectoryRegion[];
  signals?: readonly Signal[];
  marketMetrics?: readonly MarketMetric[];
  activeRegionId?: string | null;
  getRegionHref?: (region: GlobalDirectoryRegion) => string;
  representativeCountryLimit?: number;
  className?: string;
  locale?: DisplayLocale;
}

/**
 * Global continent directory for the public home and continent pages. Demo
 * records are visible as a boundary indicator but never count as real data
 * availability.
 */
export function GlobalMarketDirectory({
  regions,
  signals = [],
  marketMetrics = [],
  activeRegionId,
  getRegionHref = defaultRegionHref,
  representativeCountryLimit = 6,
  className,
  locale = "zh-CN",
}: GlobalMarketDirectoryProps) {
  const copy = getMessages(locale).globalDirectory;
  const regionLabel = (region: GlobalDirectoryRegion) =>
    regionDisplayName(region, locale);
  const availabilityLabel = (counts: RecordCounts): string => {
    const state = availabilityState(counts);
    if (state === "available") return copy.available(realRecordCount(counts));
    if (state === "demo-only") return copy.demoOnly;
    return copy.noData;
  };

  const continents = regions
    .filter((region) => region.region_type === "continent")
    .sort(compareContinents);
  const activeRegion = regions.find((region) => region.id === activeRegionId);
  const continentEntries = continents.map((continent) => {
    const countries = regions
      .filter(
        (region) =>
          region.region_type === "country" && region.parent_id === continent.id,
      )
      .sort(compareCountries);
    const counts = countPublishedRecords(continent, regions, signals, marketMetrics);
    const rankedCountries = countries
      .map((country) => ({
        region: country,
        counts: countPublishedRecords(country, regions, signals, marketMetrics),
      }))
      .sort((left, right) => {
        const realDelta = realRecordCount(right.counts) - realRecordCount(left.counts);
        if (realDelta !== 0) return realDelta;
        return compareCountries(left.region, right.region);
      });

    return {
      continent,
      countries,
      counts,
      representativeCountries: rankedCountries.slice(
        0,
        Math.max(0, representativeCountryLimit),
      ),
    };
  });
  const directoryCounts = continentEntries.reduce(
    (total, entry) => addCounts(total, entry.counts),
    EMPTY_COUNTS,
  );
  const expectedContinentCount = 6;

  if (!continents.length) {
    return (
      <section
        className={classNames(styles.directory, styles.configurationState, className)}
        aria-labelledby="global-directory-title"
      >
        <div className={styles.configurationCard}>
          <span>REGION CONFIGURATION REQUIRED</span>
          <h2 id="global-directory-title">{copy.configTitle}</h2>
          <p>{copy.configBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="global-market-directory"
      className={classNames(styles.directory, className)}
      aria-labelledby="global-directory-title"
    >
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.eyebrow}>{copy.eyebrow}</div>
          <h2 id="global-directory-title">
            {copy.title}
            <br />
            <em>{copy.titleEm}</em>
          </h2>
          <p>{copy.description}</p>
        </div>

        <aside className={styles.summary} aria-label={copy.summaryLabel}>
          <div className={styles.summaryTopline}>
            <span>{copy.availability}</span>
            <strong>
              {continents.length} / {expectedContinentCount}
            </strong>
          </div>
          <div className={styles.summaryValue}>
            <strong>
              {realRecordCount(directoryCounts) || copy.noneYet}
            </strong>
            <span>
              {realRecordCount(directoryCounts) > 0
                ? copy.realRecords
                : copy.noRealData}
            </span>
          </div>
          <dl className={styles.summaryGrid}>
            <div>
              <dt>{copy.publishedSignals}</dt>
              <dd>{directoryCounts.realSignals}</dd>
            </div>
            <div>
              <dt>{copy.publishedMetrics}</dt>
              <dd>{directoryCounts.realMetrics}</dd>
            </div>
            <div>
              <dt>{copy.demoExcluded}</dt>
              <dd>{demoRecordCount(directoryCounts)}</dd>
            </div>
          </dl>
          <p>{copy.summaryNote}</p>
        </aside>
      </header>

      {continents.length !== expectedContinentCount ? (
        <div className={styles.configurationNotice} role="note">
          <span>REGION CONFIG INCOMPLETE</span>
          {copy.incomplete(continents.length, expectedContinentCount)}
        </div>
      ) : null}

      <div className={styles.sectionHeader}>
        <div>
          <span>{copy.sectionKicker}</span>
          <h3>{copy.sectionTitle}</h3>
        </div>
        <p>{copy.sectionHint}</p>
      </div>

      <div className={styles.continentGrid}>
        {continentEntries.map((entry, index) => {
          const state = availabilityState(entry.counts);
          const active = activeRegion
            ? descendantIds(entry.continent.id, regions).has(activeRegion.id)
            : false;
          const secondaryName =
            locale === "en"
              ? entry.continent.name_zh
              : entry.continent.name_en;
          return (
            <article
              className={classNames(
                styles.continentCard,
                active && styles.continentCardActive,
              )}
              data-state={state}
              key={entry.continent.id}
            >
              <header className={styles.cardHeader}>
                <span className={styles.cardIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={styles.cardStatus} data-state={state}>
                  <i aria-hidden="true" />
                  {availabilityLabel(entry.counts)}
                </div>
              </header>

              <div className={styles.cardTitle}>
                <div>
                  <span>{entry.continent.code || entry.continent.slug}</span>
                  <h4>{regionLabel(entry.continent)}</h4>
                  {secondaryName ? <p>{secondaryName}</p> : null}
                </div>
                {entry.continent.is_demo || demoRecordCount(entry.counts) > 0 ? (
                  <span className={styles.demoBadge}>Demo boundary</span>
                ) : null}
              </div>

              <dl className={styles.cardMetrics}>
                <div>
                  <dt>Signals</dt>
                  <dd>{entry.counts.realSignals}</dd>
                </div>
                <div>
                  <dt>Metrics</dt>
                  <dd>{entry.counts.realMetrics}</dd>
                </div>
                <div>
                  <dt>Countries</dt>
                  <dd>{entry.countries.length}</dd>
                </div>
              </dl>

              <div className={styles.countrySection}>
                <div className={styles.countryLabel}>
                  <span>{copy.representativeCountries}</span>
                  <strong>{copy.total(entry.countries.length)}</strong>
                </div>
                {entry.representativeCountries.length ? (
                  <ul className={styles.countryList}>
                    {entry.representativeCountries.map(({ region, counts }) => {
                      const countryState = availabilityState(counts);
                      return (
                        <li key={region.id}>
                          <a
                            href={getRegionHref(region)}
                            aria-current={
                              activeRegionId === region.id ? "page" : undefined
                            }
                            aria-label={`${regionLabel(region)}, ${availabilityLabel(counts)}`}
                          >
                            <span>
                              <strong>{regionLabel(region)}</strong>
                              <small>{region.code || region.slug}</small>
                            </span>
                            <span
                              className={styles.countryAvailability}
                              data-state={countryState}
                            >
                              {realRecordCount(counts) > 0
                                ? realRecordCount(counts)
                                : countryState === "demo-only"
                                  ? "DEMO"
                                  : "—"}
                            </span>
                            <i aria-hidden="true">→</i>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className={styles.emptyCountries}>{copy.emptyCountries}</div>
                )}
              </div>

              <footer className={styles.cardFooter}>
                <span>
                  Demo {demoRecordCount(entry.counts)} · Real{" "}
                  {realRecordCount(entry.counts)}
                </span>
                <a
                  href={getRegionHref(entry.continent)}
                  aria-current={
                    activeRegionId === entry.continent.id ? "page" : undefined
                  }
                >
                  {copy.enterContinent} <span aria-hidden="true">↗</span>
                </a>
              </footer>
            </article>
          );
        })}
      </div>

      <footer className={styles.boundaryNote}>
        <span>{copy.boundaryTitle}</span>
        <p>{copy.boundaryBody}</p>
      </footer>
    </section>
  );
}
