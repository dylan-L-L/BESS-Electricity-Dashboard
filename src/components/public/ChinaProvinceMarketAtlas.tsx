"use client";

import { useMemo, useState } from "react";

import {
  chinaTopicCopy,
  type DisplayLocale,
  fieldCoverageLabel,
  getMessages,
  legalStatusLabel,
  localeTag,
  operationalStatusLabel,
  regionDisplayName,
} from "@/lib/i18n";
import type {
  MarketMetric,
  ProvinceTopicField,
  ProvinceTopicRecordWithFields,
  Region,
  Signal,
} from "@/lib/types";

import {
  CHINA_MARKET_TOPICS,
  type ChinaMarketTopicId,
} from "./china-market-data";
import styles from "./ChinaProvinceMarketAtlas.module.css";

type TopicDefinition = (typeof CHINA_MARKET_TOPICS)[number];

function classNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

function regionMonogram(region: Region, locale: DisplayLocale): string {
  return regionDisplayName(region, locale).slice(0, 1);
}

function findChinaRegion(
  regions: readonly Region[],
  chinaRegionId?: string,
): Region | undefined {
  if (chinaRegionId) {
    return regions.find((region) => region.id === chinaRegionId);
  }
  return regions.find(
    (region) =>
      region.region_type === "country" &&
      (region.name_zh === "中国" ||
        region.slug === "china" ||
        region.code === "CN" ||
        region.code === "CHN"),
  );
}

function publishedSignalsOnly(signals: readonly Signal[]): Signal[] {
  return signals.filter(
    (signal) =>
      signal.review_status === "published" &&
      signal.published_at !== null &&
      signal.is_demo !== true,
  );
}

function publishedMetricsOnly(
  metrics: readonly MarketMetric[],
): MarketMetric[] {
  return metrics.filter(
    (metric) => metric.is_published === true && metric.is_demo !== true,
  );
}

function publishedTopicRecordsOnly(
  records: readonly ProvinceTopicRecordWithFields[],
): ProvinceTopicRecordWithFields[] {
  return records.filter(
    (record) =>
      record.review_status === "published" &&
      record.published_at !== null,
  );
}

function recordCellKey(regionId: string, topicId: ChinaMarketTopicId) {
  return `${regionId}:${topicId}`;
}

function latestRecordByCell(
  records: readonly ProvinceTopicRecordWithFields[],
) {
  const result = new Map<string, ProvinceTopicRecordWithFields>();
  for (const record of records) {
    const key = recordCellKey(record.region_id, record.topic_id);
    const current = result.get(key);
    if (
      !current ||
      new Date(record.published_at ?? 0).getTime() >
        new Date(current.published_at ?? 0).getTime()
    ) {
      result.set(key, record);
    }
  }
  return result;
}

function availableFieldCount(record?: ProvinceTopicRecordWithFields) {
  return (
    record?.fields.filter(
      (field) =>
        field.coverage_status === "available" &&
        Boolean(field.value_text?.trim()),
    ).length ?? 0
  );
}

function fieldForKey(
  record: ProvinceTopicRecordWithFields | undefined,
  fieldKey: string,
): ProvinceTopicField | undefined {
  return record?.fields.find((field) => field.field_key === fieldKey);
}

function formatDate(value: string | null | undefined, locale: DisplayLocale) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function localizedTopic(topic: TopicDefinition, locale: DisplayLocale) {
  const enCopy = chinaTopicCopy(topic.id, locale);
  if (!enCopy) {
    return {
      shortLabel: topic.shortLabel,
      title: topic.title,
      description: topic.description,
      fields: topic.fields.map((field) => ({
        key: field.key,
        label: field.label,
        description: field.description,
        valueKind: field.valueKind,
      })),
    };
  }
  return {
    shortLabel: enCopy.shortLabel,
    title: enCopy.title,
    description: enCopy.description,
    fields: topic.fields.map((field) => {
      const translated = enCopy.fields[field.key];
      return {
        key: field.key,
        label: translated?.label ?? field.label,
        description: translated?.description ?? field.description,
        valueKind: field.valueKind,
      };
    }),
  };
}

function recordCoverageState(
  record: ProvinceTopicRecordWithFields | undefined,
  expectedFieldCount: number,
) {
  if (!record) return "no_topic_data";
  return availableFieldCount(record) === expectedFieldCount
    ? "complete"
    : "partial";
}

export interface ChinaProvinceMarketAtlasProps {
  /** The regions table is the only province registry used by this component. */
  regions: readonly Region[];
  /** Optional explicit China country row id; recommended when integrating. */
  chinaRegionId?: string;
  /** Generic records remain separate and are shown only as supporting counts. */
  signals?: readonly Signal[];
  marketMetrics?: readonly MarketMetric[];
  /** Reviewed field-level records from the dedicated province-topic module. */
  provinceTopics?: readonly ProvinceTopicRecordWithFields[];
  initialProvinceId?: string;
  initialTopicId?: ChinaMarketTopicId;
  className?: string;
  locale?: DisplayLocale;
  onProvinceChange?: (provinceId: string) => void;
  onTopicChange?: (topicId: ChinaMarketTopicId) => void;
}

/**
 * Read-only province/topic explorer. Values are sourced exclusively from the
 * dedicated published topic model; generic Signals and Metrics are never
 * inferred into topic facts.
 */
export function ChinaProvinceMarketAtlas({
  regions,
  chinaRegionId,
  signals = [],
  marketMetrics = [],
  provinceTopics = [],
  initialProvinceId,
  initialTopicId = "trading-rules",
  className,
  locale = "zh-CN",
  onProvinceChange,
  onTopicChange,
}: ChinaProvinceMarketAtlasProps) {
  const copy = getMessages(locale).chinaAtlas;
  const regionLabel = (region: Region) => regionDisplayName(region, locale);
  const chinaRegion = findChinaRegion(regions, chinaRegionId);
  const provinces = useMemo(
    () =>
      chinaRegion
        ? regions
            .filter(
              (region) =>
                region.region_type === "province" &&
                region.parent_id === chinaRegion.id,
            )
            .sort((left, right) =>
              regionDisplayName(left, locale).localeCompare(
                regionDisplayName(right, locale),
                localeTag(locale),
              ),
            )
        : [],
    [chinaRegion, locale, regions],
  );
  const publishedSignals = useMemo(
    () => publishedSignalsOnly(signals),
    [signals],
  );
  const publishedMetrics = useMemo(
    () => publishedMetricsOnly(marketMetrics),
    [marketMetrics],
  );
  const publishedTopicRecords = useMemo(
    () => publishedTopicRecordsOnly(provinceTopics),
    [provinceTopics],
  );
  const provinceIds = useMemo(
    () => new Set(provinces.map((province) => province.id)),
    [provinces],
  );
  const chinaSignals = publishedSignals.filter(
    (signal) => signal.region_id && provinceIds.has(signal.region_id),
  );
  const chinaMetrics = publishedMetrics.filter((metric) =>
    provinceIds.has(metric.region_id),
  );
  const chinaTopicRecords = publishedTopicRecords.filter((record) =>
    provinceIds.has(record.region_id),
  );
  const recordsByCell = useMemo(
    () => latestRecordByCell(chinaTopicRecords),
    [chinaTopicRecords],
  );

  const [activeProvinceId, setActiveProvinceId] = useState(
    initialProvinceId ?? "",
  );
  const [activeTopicId, setActiveTopicId] =
    useState<ChinaMarketTopicId>(initialTopicId);
  const [query, setQuery] = useState("");

  const activeTopicBase =
    CHINA_MARKET_TOPICS.find((topic) => topic.id === activeTopicId) ??
    CHINA_MARKET_TOPICS[0];
  const activeTopic = localizedTopic(activeTopicBase, locale);
  const activeProvince =
    provinces.find((province) => province.id === activeProvinceId) ??
    provinces.find((province) => province.slug === "shandong") ??
    provinces[0];
  const activeRecord = activeProvince
    ? recordsByCell.get(recordCellKey(activeProvince.id, activeTopicBase.id))
    : undefined;

  const normalizedQuery = query.trim().toLocaleLowerCase(localeTag(locale));
  const filteredProvinces = provinces.filter((province) =>
    [province.name_zh, province.name_en, province.code, province.slug]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase(localeTag(locale))
      .includes(normalizedQuery),
  );

  const activeProvinceSignals = activeProvince
    ? chinaSignals.filter((signal) => signal.region_id === activeProvince.id)
    : [];
  const activeProvinceMetrics = activeProvince
    ? chinaMetrics.filter((metric) => metric.region_id === activeProvince.id)
    : [];
  const activeTopicRecords = provinces
    .map((province) =>
      recordsByCell.get(recordCellKey(province.id, activeTopicBase.id)),
    )
    .filter(
      (
        record,
      ): record is ProvinceTopicRecordWithFields => Boolean(record),
    );
  const activeTopicAvailableFields = activeTopicRecords.reduce(
    (total, record) => total + availableFieldCount(record),
    0,
  );
  const topicProvinceCoverage =
    provinces.length > 0
      ? Math.round((activeTopicRecords.length / provinces.length) * 100)
      : 0;
  const hasExpectedProvinceRegistry = provinces.length === 31;
  const activeCoverageState = recordCoverageState(
    activeRecord,
    activeTopic.fields.length,
  );

  function selectProvince(province: Region) {
    setActiveProvinceId(province.id);
    onProvinceChange?.(province.id);
  }

  function selectTopic(topic: TopicDefinition) {
    setActiveTopicId(topic.id);
    onTopicChange?.(topic.id);
  }

  function handleTopicKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % CHINA_MARKET_TOPICS.length;
    }
    if (event.key === "ArrowLeft") {
      nextIndex =
        (index - 1 + CHINA_MARKET_TOPICS.length) %
        CHINA_MARKET_TOPICS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = CHINA_MARKET_TOPICS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const topic = CHINA_MARKET_TOPICS[nextIndex];
    selectTopic(topic);
    document.getElementById(`china-topic-${topic.id}`)?.focus();
  }

  if (!chinaRegion) {
    return (
      <section
        className={classNames(
          styles.atlas,
          styles.configurationState,
          className,
        )}
        aria-labelledby="china-market-atlas-title"
      >
        <div className={styles.configurationCard}>
          <span>REGION CONFIGURATION REQUIRED</span>
          <h2 id="china-market-atlas-title">{copy.configTitle}</h2>
          <p>{copy.configBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="china-market-atlas"
      className={classNames(styles.atlas, className)}
      aria-labelledby="china-market-atlas-title"
    >
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>{copy.eyebrow}</div>
          <h2 id="china-market-atlas-title">
            {copy.titleProvinces(provinces.length || "—")}
            <br />
            <em>
              {copy.titleEm1}
              <br />
              {copy.titleEm2}
            </em>
          </h2>
          <p>{copy.description}</p>
          <div
            className={styles.boundaryFlag}
            data-complete={hasExpectedProvinceRegistry}
          >
            <span aria-hidden="true" />
            {hasExpectedProvinceRegistry
              ? "REGIONS TABLE · 31 / 31"
              : `REGION CONFIG INCOMPLETE · ${provinces.length} / 31`}
          </div>
        </div>

        <aside className={styles.coverageCard} aria-label={copy.coverageLabel}>
          <div className={styles.coverageTopline}>
            <span>PUBLISHED TOPIC COVERAGE</span>
            <strong>{activeTopicBase.index} / 07</strong>
          </div>
          <div className={styles.coverageValue}>
            <strong>{topicProvinceCoverage}%</strong>
            <span>
              {copy.provincesWithRecords(
                activeTopicRecords.length,
                provinces.length,
              )}
            </span>
          </div>
          <div className={styles.coverageTrack} aria-hidden="true">
            <span style={{ width: `${topicProvinceCoverage}%` }} />
          </div>
          <dl className={styles.coverageMeta}>
            <div>
              <dt>Topic records</dt>
              <dd>{copy.topicRecords(activeTopicRecords.length)}</dd>
            </div>
            <div>
              <dt>Available fields</dt>
              <dd>{copy.availableFields(activeTopicAvailableFields)}</dd>
            </div>
            <div>
              <dt>Province rows</dt>
              <dd>{copy.provinceRows(provinces.length)}</dd>
            </div>
          </dl>
          <p className={styles.coverageRule}>{copy.coverageRule}</p>
        </aside>
      </header>

      <div className={styles.topicRail}>
        <div className={styles.railLabel}>
          <span>{copy.topicLedger}</span>
          <strong>{copy.sevenTopics}</strong>
        </div>
        <div
          className={styles.topicTabs}
          role="tablist"
          aria-label={copy.topicTabs}
        >
          {CHINA_MARKET_TOPICS.map((topic, index) => {
            const selected = topic.id === activeTopicBase.id;
            const topicCopy = localizedTopic(topic, locale);
            return (
              <button
                type="button"
                role="tab"
                id={`china-topic-${topic.id}`}
                aria-selected={selected}
                aria-controls="china-topic-panel"
                tabIndex={selected ? 0 : -1}
                className={classNames(
                  styles.topicTab,
                  selected && styles.topicTabActive,
                )}
                onClick={() => selectTopic(topic)}
                onKeyDown={(event) => handleTopicKeyDown(event, index)}
                key={topic.id}
              >
                <span>{topic.index}</span>
                <strong>{topicCopy.shortLabel}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={styles.topicIntro}
        role="tabpanel"
        id="china-topic-panel"
        aria-labelledby={`china-topic-${activeTopicBase.id}`}
      >
        <div>
          <span>{activeTopicBase.index} / TOPIC</span>
          <h3>{activeTopic.title}</h3>
        </div>
        <p>{activeTopic.description}</p>
      </div>

      <div className={styles.workspace}>
        <section
          className={styles.provincePanel}
          aria-labelledby="province-directory-title"
        >
          <div className={styles.panelHeader}>
            <div>
              <span>{copy.provinceDirectory}</span>
              <h3 id="province-directory-title">{copy.provinceIndex}</h3>
            </div>
            <span className={styles.resultCount} aria-live="polite">
              {filteredProvinces.length} / {provinces.length}
            </span>
          </div>

          <label className={styles.searchBox}>
            <span className={styles.srOnly}>{copy.searchLabel}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={copy.clearSearch}
              >
                ×
              </button>
            ) : null}
          </label>

          {filteredProvinces.length ? (
            <div className={styles.provinceGrid} aria-label={copy.provinceList}>
              {filteredProvinces.map((province) => {
                const selected = province.id === activeProvince?.id;
                const record = recordsByCell.get(
                  recordCellKey(province.id, activeTopicBase.id),
                );
                const availabilityState = recordCoverageState(
                  record,
                  activeTopic.fields.length,
                );
                const fieldCount = availableFieldCount(record);
                const statusText = record
                  ? copy.fieldStatus(fieldCount, activeTopic.fields.length)
                  : copy.noTopicRecord;
                return (
                  <button
                    type="button"
                    className={classNames(
                      styles.provinceButton,
                      selected && styles.provinceButtonActive,
                    )}
                    data-state={availabilityState}
                    aria-pressed={selected}
                    aria-label={`${regionLabel(province)}, ${statusText}`}
                    onClick={() => selectProvince(province)}
                    key={province.id}
                  >
                    <span className={styles.provinceShort}>
                      {regionMonogram(province, locale)}
                    </span>
                    <span className={styles.provinceName}>
                      {regionLabel(province)}
                    </span>
                    <i aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.noResults}>{copy.noMatchingProvinces}</div>
          )}

          <div className={styles.statusLegend} aria-label={copy.coverageLegend}>
            <span data-state="complete">
              <i aria-hidden="true" /> {copy.legendComplete}
            </span>
            <span data-state="partial">
              <i aria-hidden="true" /> {copy.legendPartial}
            </span>
            <span data-state="no_topic_data">
              <i aria-hidden="true" /> {copy.legendNone}
            </span>
          </div>
        </section>

        {activeProvince ? (
          <article className={styles.detailPanel} aria-live="polite">
            <header className={styles.detailHeader}>
              <div className={styles.provinceMonogram} aria-hidden="true">
                {regionMonogram(activeProvince, locale)}
              </div>
              <div className={styles.detailTitle}>
                <span>
                  {activeProvince.code || activeProvince.slug} /{" "}
                  {activeTopicBase.index}
                </span>
                <h3>{regionLabel(activeProvince)}</h3>
                <p>{activeTopic.title}</p>
              </div>
              <span
                className={styles.detailStatus}
                data-state={activeCoverageState}
              >
                {activeRecord
                  ? activeCoverageState === "complete"
                    ? copy.legendComplete
                    : copy.fieldStatus(
                        availableFieldCount(activeRecord),
                        activeTopic.fields.length,
                      )
                  : copy.noTopicRecord}
              </span>
            </header>

            {activeRecord?.is_demo ? (
              <div className={styles.demoNotice}>
                DEMO · {getMessages(locale).demoRibbon}
              </div>
            ) : null}

            <div className={styles.fieldGrid}>
              {activeTopic.fields.map((definition) => {
                const field = fieldForKey(activeRecord, definition.key);
                const state = field?.coverage_status ?? "no_topic_data";
                const statusLabel = field
                  ? fieldCoverageLabel(field.coverage_status, locale)
                  : copy.noTopicRecord;
                const hasValue = Boolean(field?.value_text?.trim());
                return (
                  <section
                    className={styles.fieldCard}
                    data-state={state}
                    key={definition.key}
                  >
                    <div className={styles.fieldTopline}>
                      <span>{definition.valueKind}</span>
                      <strong data-state={state}>{statusLabel}</strong>
                    </div>
                    <h4>{definition.label}</h4>
                    <p>{definition.description}</p>
                    <div
                      className={styles.fieldValue}
                      data-empty={!hasValue}
                    >
                      <strong>{hasValue ? field?.value_text : "—"}</strong>
                      {hasValue && field?.unit ? (
                        <small>{field.unit}</small>
                      ) : null}
                    </div>
                    {field?.applicability || field?.source_locator ? (
                      <dl className={styles.fieldEvidence}>
                        {field.applicability ? (
                          <div>
                            <dt>{copy.source}</dt>
                            <dd>{field.applicability}</dd>
                          </div>
                        ) : null}
                        {field.source_locator ? (
                          <div>
                            <dt>{copy.evidence}</dt>
                            <dd>{field.source_locator}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                    <div className={styles.sourceRow}>
                      {field?.source_url ? (
                        <a
                          href={field.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {field.source_name || copy.source} ↗
                        </a>
                      ) : (
                        <span>{copy.noPublishedFields}</span>
                      )}
                      <time>{formatDate(activeRecord?.as_of_date, locale)}</time>
                    </div>
                  </section>
                );
              })}
            </div>

            <footer className={styles.detailFooter}>
              {activeRecord ? (
                <>
                  <div>
                    <span>{copy.topicUnit}</span>
                    <strong>{activeRecord.title || activeTopic.title}</strong>
                  </div>
                  <p>
                    {copy.legalStatus}:{" "}
                    {legalStatusLabel(activeRecord.legal_status, locale)}
                    {activeRecord.operational_status
                      ? ` · ${copy.operationalStatus}: ${operationalStatusLabel(
                          activeRecord.operational_status,
                          locale,
                        )}`
                      : ""}
                    {` · ${copy.asOf} ${formatDate(activeRecord.as_of_date, locale)}`}
                  </p>
                  {activeRecord.source_url ? (
                    <a
                      className={styles.recordSourceLink}
                      href={activeRecord.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {activeRecord.source_name || copy.source} ↗
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  <div>
                    <span>
                      {copy.supportingSignals} / {copy.supportingMetrics}
                    </span>
                    <strong>
                      {activeProvinceSignals.length} Signals ·{" "}
                      {activeProvinceMetrics.length} Metrics
                    </strong>
                  </div>
                  <p>{copy.supportingNote}</p>
                </>
              )}
            </footer>
          </article>
        ) : (
          <div className={styles.noProvinceState}>
            <strong>{copy.configTitle}</strong>
            <p>{copy.configBody}</p>
          </div>
        )}
      </div>

      <footer className={styles.methodology}>
        <span>Availability protocol</span>
        <p>{copy.coverageRule}</p>
      </footer>
    </section>
  );
}
