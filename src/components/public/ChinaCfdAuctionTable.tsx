import type { ChinaCfdAuction } from "@/lib/types";
import { localizeCfdNote } from "@/lib/china-market/cfd-localize";

import styles from "./ChinaCfdAuctionTable.module.css";

const GRID_REGION_ORDER = ["华北", "东北", "西北", "华中", "华东", "南方"];

function regionOrder(region: string | null) {
  const index = region ? GRID_REGION_ORDER.indexOf(region) : -1;
  return index === -1 ? GRID_REGION_ORDER.length : index;
}

function num(value: number | null, digits = 1) {
  if (value == null) return "—";
  const rounded =
    Math.abs(value) >= 1000
      ? Math.round(value).toLocaleString("zh-CN")
      : Number(value.toFixed(digits)).toString();
  return rounded;
}

function percent(value: number | null) {
  return value == null ? "—" : `${Number(value.toFixed(1))}%`;
}

function durationLabel(auction: ChinaCfdAuction) {
  const parts: string[] = [];
  const { duration_years_onshore, duration_years_offshore, duration_years_solar } = auction;
  const values = [duration_years_onshore, duration_years_offshore, duration_years_solar].filter(
    (value): value is number => value != null,
  );
  if (!values.length) return "—";
  if (new Set(values).size === 1) return String(values[0]);
  if (duration_years_onshore != null) parts.push(`风${duration_years_onshore}`);
  if (duration_years_offshore != null) parts.push(`海风${duration_years_offshore}`);
  if (duration_years_solar != null) parts.push(`光${duration_years_solar}`);
  return parts.join(" / ");
}

export function ChinaCfdAuctionTable({
  auctions,
  className,
}: {
  auctions: readonly ChinaCfdAuction[];
  className?: string;
}) {
  if (!auctions.length) return null;

  const sorted = [...auctions].sort((left, right) => {
    const region = regionOrder(left.grid_region) - regionOrder(right.grid_region);
    if (region !== 0) return region;
    const label = left.province_label.localeCompare(right.province_label, "zh-CN");
    if (label !== 0) return label;
    return (left.delivery_year ?? 9999) - (right.delivery_year ?? 9999);
  });

  return (
    <section
      id="china-cfd-auctions"
      className={`${styles.wrapper}${className ? ` ${className}` : ""}`}
      aria-labelledby="china-cfd-auctions-title"
    >
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            CfD auction ledger / 风光机制电价竞价总表
          </div>
          <h2 id="china-cfd-auctions-title">
            136号文 机制电价<em>竞价总表</em>
          </h2>
          <p>
            按“省级电网区域 × 竞价轮次”展示各省风光机制电价（差价合约）竞价条款与结果。
            空值表示未公布，不代表数值为 0；数据可由管理员在后台逐格修订。
          </p>
        </div>
      </header>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th rowSpan={2}>区域</th>
              <th rowSpan={2}>省份 / 电网</th>
              <th rowSpan={2}>轮次</th>
              <th rowSpan={2}>公告日期</th>
              <th rowSpan={2}>交付年</th>
              <th rowSpan={2}>状态</th>
              <th colSpan={3}>陆上风电 元/MWh</th>
              <th colSpan={3}>海上风电 元/MWh</th>
              <th colSpan={3}>光伏 元/MWh</th>
              <th rowSpan={2}>煤电基准<br />元/MWh</th>
              <th colSpan={3}>机制电量 GWh</th>
              <th rowSpan={2}>期限<br />年</th>
              <th rowSpan={2}>结果公告</th>
              <th rowSpan={2}>省级政策</th>
            </tr>
            <tr>
              <th>下限</th>
              <th>上限</th>
              <th>出清</th>
              <th>下限</th>
              <th>上限</th>
              <th>出清</th>
              <th>下限</th>
              <th>上限</th>
              <th>出清</th>
              <th>目标</th>
              <th>中标</th>
              <th>认购率</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((auction, index) => {
              const showRegion =
                index === 0 || sorted[index - 1].grid_region !== auction.grid_region;
              return (
                <tr key={auction.id}>
                  <td className={styles.regionCell}>
                    {showRegion ? auction.grid_region ?? "—" : ""}
                  </td>
                  <td className={styles.provinceCell}>
                    <strong>{auction.province_label}</strong>
                    {auction.is_demo ? <span className={styles.demoTag}>DEMO</span> : null}
                  </td>
                  <td>{auction.auction_round ?? "—"}</td>
                  <td className={styles.dateCell}>{auction.announcement_date ?? "—"}</td>
                  <td>{auction.delivery_year ?? "—"}</td>
                  <td>
                    <span
                      className={styles.status}
                      data-completed={auction.status === "已完成"}
                    >
                      {auction.status ?? "—"}
                    </span>
                  </td>
                  <td>{num(auction.onshore_wind_floor)}</td>
                  <td>{num(auction.onshore_wind_cap)}</td>
                  <td className={styles.strike}>{num(auction.onshore_wind_strike)}</td>
                  <td>{num(auction.offshore_wind_floor)}</td>
                  <td>{num(auction.offshore_wind_cap)}</td>
                  <td className={styles.strike}>{num(auction.offshore_wind_strike)}</td>
                  <td>{num(auction.solar_floor)}</td>
                  <td>{num(auction.solar_cap)}</td>
                  <td className={styles.strike}>{num(auction.solar_strike)}</td>
                  <td>{num(auction.coal_benchmark)}</td>
                  <td>{num(auction.target_volume_gwh, 0)}</td>
                  <td>{num(auction.awarded_volume_gwh, 0)}</td>
                  <td>{percent(auction.subscription_rate)}</td>
                  <td>{durationLabel(auction)}</td>
                  <td>
                    {auction.source_url ? (
                      <a
                        href={auction.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={
                          localizeCfdNote(auction.note) ??
                          auction.source_name ??
                          undefined
                        }
                      >
                        结果 ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {auction.implementation_plan_url ? (
                      <a
                        href={auction.implementation_plan_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={auction.implementation_plan_name ?? undefined}
                      >
                        {auction.implementation_plan_name ?? "实施方案"} ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.footnote}>
        价格为竞价公告或结果原文数值（元/MWh）；“出清”为竞价形成的机制电价。目标 / 中标电量为风光合计（GWh）。
        期限为机制执行年限，风光不同则分别标注。空值表示官方未公布该项，真实数值 0 保持为 0。
      </p>
    </section>
  );
}
