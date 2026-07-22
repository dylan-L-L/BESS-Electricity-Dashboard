import type { Region, Signal } from "@/lib/types";
import Link from "next/link";

import {
  formatDate,
  formatOptionalText,
  normalizedStatusLabel,
} from "./formatters";
import { isPublishedSignal, StatusPill } from "./Dashboard";

type DemoAware = { is_demo?: boolean };

export interface SignalDetailProps {
  signal: Signal;
  region?: Region | null;
  backHref?: string;
  regionHref?: string;
}

export function SignalDetail({ signal, region, backHref = "/", regionHref }: SignalDetailProps) {
  if (!isPublishedSignal(signal)) {
    return null;
  }

  const isDemo = Boolean((signal as Signal & DemoAware).is_demo);
  const regionName = region?.name_zh || region?.name_en || region?.code || "未指定地区";

  return (
    <main className="gl-detail-page">
      {isDemo ? (
        <div className="gl-demo-ribbon gl-demo-ribbon-static" role="note">
          <span>Demo data</span> 此记录为演示内容，不代表真实政策或市场结论
        </div>
      ) : null}

      <header className="gl-detail-topbar">
        <Link className="gl-detail-brand" href="/" aria-label="Grid Ledger 首页">
          <span className="gl-brand-mark" aria-hidden="true" />
          <strong>Grid Ledger</strong>
        </Link>
        <a className="gl-back-link" href={backHref}>
          ← 返回看板
        </a>
      </header>

      <article className="gl-dossier">
        <header className="gl-dossier-header">
          <div className="gl-eyebrow">Intelligence dossier / 情报档案</div>
          <div className="gl-detail-region">
            {regionHref ? <a href={regionHref}>{regionName}</a> : regionName}
            <span>·</span>
            <span>{formatOptionalText(signal.category)}</span>
            {isDemo ? <span className="gl-demo-pill">Demo</span> : null}
          </div>
          <h1>{signal.title}</h1>
          <StatusPill status={signal.normalized_status} />
          <p className="gl-dossier-summary">{signal.summary}</p>
        </header>

        <section className="gl-drawer-grid" aria-label="记录信息">
          <div className="gl-drawer-stat">
            <span>Event status / 规范状态</span>
            <strong>{normalizedStatusLabel(signal.normalized_status)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>Original status / 原始状态</span>
            <strong>{formatOptionalText(signal.original_status)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>Event date / 事件日期</span>
            <strong>{formatDate(signal.event_date)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>Effective date / 生效日期</span>
            <strong>{formatDate(signal.effective_date)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>Impact channel / 影响渠道</span>
            <strong>{formatOptionalText(signal.impact_channel)}</strong>
          </div>
          <div className="gl-drawer-stat">
            <span>Direction · level / 方向与级别</span>
            <strong>
              {formatOptionalText(signal.impact_direction)} · {formatOptionalText(signal.impact_level)}
            </strong>
          </div>
        </section>

        <section className="gl-drawer-section">
          <h2>Human review / 人工核验</h2>
          <p>{formatOptionalText(signal.reviewer_note)}</p>
          <dl className="gl-review-meta">
            <div>
              <dt>Review status</dt>
              <dd>Published / 已发布</dd>
            </div>
            <div>
              <dt>Published at</dt>
              <dd>{formatDate(signal.published_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="gl-drawer-section">
          <h2>Evidence trail / 原始来源</h2>
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
            <em>OPEN ORIGINAL ↗</em>
          </a>
        </section>

        <section className="gl-drawer-section gl-research-boundary">
          <h2>Research boundary / 状态边界</h2>
          <p>
            当前记录按“{normalizedStatusLabel(signal.normalized_status)}”展示。已提交、已批准、草案与已生效是不同状态，页面不会自动推断或升级其法律效力。
          </p>
        </section>
      </article>
    </main>
  );
}
