import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CHINA_MARKET_TOPICS,
  CHINA_MARKET_TOPIC_IDS,
  type ChinaMarketTopicId,
} from "@/lib/china-market/taxonomy";

const EXPECTED_TOPIC_IDS = [
  "trading-rules",
  "storage-capacity-compensation",
  "ancillary-services",
  "fourth-regulatory-cycle-grid-cost",
  "storage-operating-costs",
  "green-power-direct-connection",
  "retail-rules",
  "renewable-mechanism-price",
];

describe("China provincial market atlas taxonomy", () => {
  it("defines eight distinct topics and 248 province-topic cells", () => {
    expect(CHINA_MARKET_TOPICS.map((topic) => topic.id)).toEqual(
      EXPECTED_TOPIC_IDS,
    );
    expect(CHINA_MARKET_TOPIC_IDS).toEqual(EXPECTED_TOPIC_IDS);
    expect(new Set(CHINA_MARKET_TOPICS.map((topic) => topic.id)).size).toBe(8);
    expect(31 * CHINA_MARKET_TOPICS.length).toBe(248);
  });

  it("keeps requested subfields and separates revenue from grid cost", () => {
    const topicsById = new Map(
      CHINA_MARKET_TOPICS.map((topic) => [topic.id, topic]),
    );
    const fieldLabels = (topicId: ChinaMarketTopicId) =>
      topicsById.get(topicId)?.fields.map((field) => field.label) ?? [];

    expect(fieldLabels("trading-rules")).toEqual(
      expect.arrayContaining([
        "现货日前规则",
        "现货实时规则",
        "辅助服务交易规则",
        "零售市场规则",
      ]),
    );
    expect(fieldLabels("storage-capacity-compensation")).toEqual(
      expect.arrayContaining([
        "补偿金额",
        "考核机制",
        "补贴时长",
        "等效折算系数",
      ]),
    );
    expect(fieldLabels("fourth-regulatory-cycle-grid-cost")).toEqual(
      expect.arrayContaining(["输配电容量电价", "输配电需量电价", "线损率"]),
    );
    expect(fieldLabels("renewable-mechanism-price")).toEqual(
      expect.arrayContaining([
        "省级承接文件",
        "存量项目机制电价",
        "增量项目机制电价",
        "机制电量规模",
        "执行期限",
        "差价结算规则",
      ]),
    );
    expect(topicsById.get("storage-capacity-compensation")?.title).toContain(
      "收益",
    );
    expect(
      topicsById.get("fourth-regulatory-cycle-grid-cost")?.title,
    ).toContain("用网成本");
    expect(topicsById.get("renewable-mechanism-price")?.title).toContain(
      "机制电价",
    );
  });

  it("uses regions as the only province registry", () => {
    const dataSource = readFileSync(
      fileURLToPath(
        new URL(
          "../../src/lib/china-market/taxonomy.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    expect(dataSource).not.toContain("CHINA_PROVINCES");
    expect(dataSource).not.toContain("tibet");
    expect(dataSource).not.toContain("xizang");
  });

  it("keeps the database topic/field allow-list aligned with the shared taxonomy", () => {
    const migrationsDir = fileURLToPath(
      new URL("../../supabase/migrations", import.meta.url),
    );
    const migration = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => readFileSync(path.join(migrationsDir, name), "utf8"))
      .join("\n");

    for (const topic of CHINA_MARKET_TOPICS) {
      expect(migration).toContain(`'${topic.id}'`);
      for (const field of topic.fields) {
        expect(migration).toContain(`'${field.key}'`);
      }
    }
  });
});
