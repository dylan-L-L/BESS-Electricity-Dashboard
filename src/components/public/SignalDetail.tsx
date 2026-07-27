import type { Region, Signal } from "@/lib/types";
import Link from "next/link";

import { type DisplayLocale, getMessages, regionDisplayName } from "@/lib/i18n";

import {
  formatDate,
  formatOptionalText,
  normalizedStatusLabel,
} from "./formatters";
import { isPublishedSignal, StatusPill } from "./Dashboard";
import { LanguageSwitcher } from "./LanguageSwitcher";

type DemoAware = { is_demo?: boolean };

export interface SignalDetailProps {
  signal: Signal;
  region?: Region | null;
  backHref?: string;
  regionHref?: string;
  locale?: DisplayLocale;
}

export function SignalDetail({
  signal,
  region,
  backHref = "/",
  regionHref,
  locale = "zh-CN",
}: SignalDetailProps) {
  if (!isPublishedSignal(signal)) {
    return null;
  }

  const copy = getMessages(locale);
  const detail = copy.signalDetail;
  const isDemo = Boolean((signal as Signal & DemoAware).is_demo);
  const regionName = regionDisplayName(
    region,
    locale,
    copy.unspecifiedRegion,
  );

  return (
    <main className="gl-detail-page">
      {isDemo ? (
        <div className="gl-demo-ribbon gl-demo-ribbon-static" role="note">
          <span>Demo data</span> {detail.demoRibbon}
        </div>
      ) : null}

      <header className="gl-detail-topbar">
        <Link className="gl-detail-brand" href="/" aria-label={detail.homeAria}>
          <span className="gl-brand-mark" aria-hidden="true" />
          <strong>Grid Ledger</strong>
        </Link>
        <div className="gl-detail-actions">
          <LanguageSwitcher locale={locale} />
          <a className="gl-back-link" href={backHref}>
            {detail.back}
          </a>
        </div>
      </header>

      <article className="gl-dossier">
        <header className="gl-dossier-header">
          <div className="gl-eyebrow">{detail.eyebrow}</div>
          <div className="gl-detail-region">
            {regionHref ? <a href={regionHref}>{regionName}</a> : regionName}
            <span>·</span>
            <span>{formatOptionalText(signal.category)}</span>
            {isDemo ? <span className="gl-demo-pill">Demo</span> : null}
          </div>
          <h1>{signal.title}</h1>
          <StatusPill status={signal.normalized_status} locale={locale} />
          <p className="gl-dossier-summary">{signal.summary}</p>
        </header>

        <section className="gl-drawer-grid" aria-label={detail.recordInfo}>
          <div className="gl-drawer-stat">
            <span>{detail.eventStatus}</span>
            <strong>{normalizedStatusLabel(signal.normalized_status, locale)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>{detail.originalStatus}</span>
            <strong>{formatOptionalText(signal.original_status)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>{detail.eventDate}</span>
            <strong>{formatDate(signal.event_date, locale)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>{detail.effectiveDate}</span>
            <strong>{formatDate(signal.effective_date, locale)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>{detail.impactChannel}</span>
            <strong>{formatOptionalText(signal.impact_channel)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>{detail.directionLevel}</span>
            <strong>
              {formatOptionalText(signal.impact_direction)} ·{" "}
              {formatOptionalText(signal.impact_level)}
            </strong>
          </div>
        </section>

        <section className="gl-drawer-section">
          <h2>{detail.humanReview}</h2>
          <p>{formatOptionalText(signal.reviewer_note)}</p>
          <dl className="gl-review-meta">
            <div>
              <dt>{detail.reviewStatus}</dt>
              <dd>{detail.reviewStatusValue}</dd>
            </div>
            <div>
              <dt>{detail.publishedAt}</dt>
              <dd>{formatDate(signal.published_at, locale)}</dd>
            </div>
          </dl>
        </section>

        <section className="gl-drawer-section">
          <h2>{detail.evidence}</h2>
          <a
            className="gl-source-card"
            href={signal.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              <strong>{formatOptionalText(signal.source_name)}</strong>
              <small>{signal.source_url}</small>
            </span>
            <em>{detail.openOriginal}</em>
          </a>
        </section>

        <section className="gl-drawer-section gl-research-boundary">
          <h2>{detail.boundary}</h2>
          <p>
            {detail.boundaryBody(
              normalizedStatusLabel(signal.normalized_status, locale),
            )}
          </p>
        </section>
      </article>
    </main>
  );
}
