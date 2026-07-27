import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISPLAY_LOCALE,
  displayLocaleCookie,
  getMessages,
  parseDisplayLocale,
  regionDisplayName,
} from "@/lib/i18n";
import { chinaTopicCopy, fieldCoverageLabel } from "@/lib/i18n/china-labels";
import { normalizedStatusLabel } from "@/components/public/formatters";

describe("display locale parsing", () => {
  it("defaults to zh-CN", () => {
    expect(parseDisplayLocale(undefined)).toBe(DEFAULT_DISPLAY_LOCALE);
    expect(parseDisplayLocale("")).toBe("zh-CN");
    expect(parseDisplayLocale("fr-FR")).toBe("zh-CN");
  });

  it("accepts zh and en variants", () => {
    expect(parseDisplayLocale("zh-CN")).toBe("zh-CN");
    expect(parseDisplayLocale("zh")).toBe("zh-CN");
    expect(parseDisplayLocale("zh-Hans")).toBe("zh-CN");
    expect(parseDisplayLocale("en")).toBe("en");
    expect(parseDisplayLocale("en-US")).toBe("en");
  });

  it("builds a persistent cookie value", () => {
    expect(displayLocaleCookie("en")).toContain("gl_display_lang=en");
    expect(displayLocaleCookie("en")).toContain("Path=/");
    expect(displayLocaleCookie("en")).toContain("SameSite=Lax");
  });
});

describe("region display names", () => {
  const region = {
    name_zh: "山东",
    name_en: "Shandong",
    code: "CN-SD",
    slug: "shandong",
  };

  it("prefers Chinese names in zh-CN and English names in en", () => {
    expect(regionDisplayName(region, "zh-CN")).toBe("山东");
    expect(regionDisplayName(region, "en")).toBe("Shandong");
  });

  it("falls back when the preferred name is missing", () => {
    expect(
      regionDisplayName({ ...region, name_en: null }, "en"),
    ).toBe("山东");
    expect(
      regionDisplayName({ ...region, name_zh: "" }, "zh-CN"),
    ).toBe("Shandong");
  });
});

describe("localized public labels", () => {
  it("returns language-specific chrome copy", () => {
    expect(getMessages("zh-CN").nav.overview).toBe("情报总览");
    expect(getMessages("en").nav.overview).toBe("Overview");
    expect(getMessages("zh-CN").search.submit).toBe("搜索");
    expect(getMessages("en").search.submit).toBe("Search");
  });

  it("localizes normalized status labels", () => {
    expect(normalizedStatusLabel("approved", "zh-CN")).toBe("已批准");
    expect(normalizedStatusLabel("approved", "en")).toBe("Approved");
  });

  it("localizes China topic and coverage labels for English", () => {
    const topic = chinaTopicCopy("trading-rules", "en");
    expect(topic?.shortLabel).toBe("Trading rules");
    expect(topic?.fields.spot_day_ahead_rule.label).toBe("Day-ahead spot rules");
    expect(fieldCoverageLabel("not_published", "en")).toBe(
      "Not officially published",
    );
    expect(fieldCoverageLabel("not_published", "zh-CN")).toBe("官方未公布");
  });
});
