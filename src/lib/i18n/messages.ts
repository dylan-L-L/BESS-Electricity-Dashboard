import type { DisplayLocale } from "./locale";

type MessageTree = {
  languageSwitcher: {
    label: string;
    zh: string;
    en: string;
  };
  demoRibbon: string;
  brandTagline: string;
  nav: {
    primary: string;
    overview: string;
    market: string;
    policy: string;
    provinceTopics: string;
    continentMarkets: string;
    sections: string;
  };
  sidebar: {
    publishedRecords: string;
    publishedOnly: string;
  };
  regionSelector: {
    label: string;
    areaDirectory: string;
    globalWatch: string;
    continents: string;
    unassignedCountries: string;
    provinces: string;
    ariaCounts: (name: string, real: number, demo: number) => string;
  };
  search: {
    label: string;
    placeholder: string;
    submit: string;
  };
  topbar: {
    dashboard: string;
    admin: string;
  };
  hero: {
    globalTitle: string;
    globalEm: string;
    regionEm: string;
    description: string;
    realSignals: string;
    realMetrics: string;
    demoFixtures: string;
  };
  mode: {
    label: string;
    combined: string;
    policy: string;
    market: string;
    provinceTopics: string;
    continentMarkets: string;
    asOf: string;
  };
  market: {
    kicker: string;
    title: string;
    empty: string;
    asOf: (date: string) => string;
  };
  status: {
    kicker: string;
    title: string;
    note: string;
  };
  policy: {
    kicker: string;
    title: string;
    empty: string;
    latest: string;
  };
  unnamedRegion: string;
  unspecifiedRegion: string;
  statusLabels: Record<string, string>;
  signalDetail: {
    demoRibbon: string;
    homeAria: string;
    back: string;
    eyebrow: string;
    recordInfo: string;
    eventStatus: string;
    originalStatus: string;
    eventDate: string;
    effectiveDate: string;
    impactChannel: string;
    directionLevel: string;
    humanReview: string;
    reviewStatus: string;
    reviewStatusValue: string;
    publishedAt: string;
    evidence: string;
    openOriginal: string;
    boundary: string;
    boundaryBody: (status: string) => string;
  };
  globalDirectory: {
    configTitle: string;
    configBody: string;
    eyebrow: string;
    title: string;
    titleEm: string;
    description: string;
    summaryLabel: string;
    availability: string;
    realRecords: string;
    noRealData: string;
    noneYet: string;
    publishedSignals: string;
    publishedMetrics: string;
    demoExcluded: string;
    summaryNote: string;
    incomplete: (current: number, expected: number) => string;
    sectionKicker: string;
    sectionTitle: string;
    sectionHint: string;
    available: (count: number) => string;
    demoOnly: string;
    noData: string;
    enterContinent: string;
    emptyCountries: string;
    representativeCountries: string;
    total: (count: number) => string;
    boundaryTitle: string;
    boundaryBody: string;
  };
  chinaAtlas: {
    configTitle: string;
    configBody: string;
    eyebrow: string;
    titleProvinces: (count: string | number) => string;
    titleEm1: string;
    titleEm2: string;
    description: string;
    coverageLabel: string;
    provincesWithRecords: (withRecords: number, total: number) => string;
    topicRecords: (count: number) => string;
    availableFields: (count: number) => string;
    provinceRows: (count: number) => string;
    coverageRule: string;
    topicLedger: string;
    sevenTopics: string;
    topicTabs: string;
    provinceDirectory: string;
    provinceIndex: string;
    searchLabel: string;
    searchPlaceholder: string;
    clearSearch: string;
    provinceList: string;
    fieldStatus: (available: number, total: number) => string;
    noTopicRecord: string;
    noMatchingProvinces: string;
    legendComplete: string;
    legendPartial: string;
    legendNone: string;
    coverageLegend: string;
    supportingSignals: string;
    supportingMetrics: string;
    topicUnit: string;
    noPublishedFields: string;
    evidence: string;
    source: string;
    legalStatus: string;
    operationalStatus: string;
    effective: string;
    asOf: string;
    demoBadge: string;
    supportingNote: string;
  };
};

const zhCN: MessageTree = {
  languageSwitcher: {
    label: "显示语言",
    zh: "中文",
    en: "EN",
  },
  demoRibbon: "演示记录仅用于产品验证，不代表真实政策或市场结论",
  brandTagline: "Policy × Market Intelligence",
  nav: {
    primary: "页面区块",
    overview: "情报总览",
    market: "市场指标",
    policy: "政策动态",
    provinceTopics: "省级专题",
    continentMarkets: "大洲市场",
    sections: "Grid Ledger 导航",
  },
  sidebar: {
    publishedRecords: "Published records",
    publishedOnly: "公开端仅展示已发布数据",
  },
  regionSelector: {
    label: "地区选择器",
    areaDirectory: "Area directory",
    globalWatch: "全局观察",
    continents: "Continent / 大洲",
    unassignedCountries: "Unassigned / 未分组国家",
    provinces: "Province / 省级",
    ariaCounts: (name, real, demo) =>
      `${name}，真实 ${real} 条，Demo ${demo} 条`,
  },
  search: {
    label: "搜索已发布内容",
    placeholder: "搜索地区、政策、市场信号…",
    submit: "搜索",
  },
  topbar: {
    dashboard: "Dashboard",
    admin: "ADMIN",
  },
  hero: {
    globalTitle: "Policy moves.",
    globalEm: "Markets answer.",
    regionEm: "policy & market desk.",
    description:
      "从已发布记录读取政策动态与市场指标。状态、日期、地区和原文来源彼此独立展示，草稿不会进入公开视图。",
    realSignals: "Real published signals",
    realMetrics: "Real market metrics",
    demoFixtures: "Demo fixtures",
  },
  mode: {
    label: "内容导航",
    combined: "综合视图",
    policy: "政策动态",
    market: "市场指标",
    provinceTopics: "省级专题",
    continentMarkets: "大洲市场",
    asOf: "DATABASE-BACKED · PUBLISHED ONLY",
  },
  market: {
    kicker: "Published market data",
    title: "市场指标",
    empty: "当前地区暂无已发布市场指标；缺失值不会按 0 展示。",
    asOf: (date) => `截至 ${date}`,
  },
  status: {
    kicker: "Status ledger",
    title: "状态分账",
    note: "Filed 不等于 Approved；Draft 不等于 Effective。状态统计仅计真实公开记录，Demo 另行标记。",
  },
  policy: {
    kicker: "Published signal feed",
    title: "政策 / 市场动态",
    empty: "没有匹配的已发布动态。",
    latest: "最新动态",
  },
  unnamedRegion: "未命名地区",
  unspecifiedRegion: "未指定地区",
  statusLabels: {
    draft: "草案",
    consultation: "征求意见",
    filed: "已提交",
    approved: "已批准",
    effective: "已生效",
    suspended: "已暂停",
    other: "其他",
  },
  signalDetail: {
    demoRibbon: "此记录为演示内容，不代表真实政策或市场结论",
    homeAria: "Grid Ledger 首页",
    back: "← 返回看板",
    eyebrow: "情报档案",
    recordInfo: "记录信息",
    eventStatus: "规范状态",
    originalStatus: "原始状态",
    eventDate: "事件日期",
    effectiveDate: "生效日期",
    impactChannel: "影响渠道",
    directionLevel: "方向与级别",
    humanReview: "人工核验",
    reviewStatus: "审核状态",
    reviewStatusValue: "已发布",
    publishedAt: "发布时间",
    evidence: "原始来源",
    openOriginal: "打开原文 ↗",
    boundary: "状态边界",
    boundaryBody: (status) =>
      `当前记录按“${status}”展示。已提交、已批准、草案与已生效是不同状态，页面不会自动推断或升级其法律效力。`,
  },
  globalDirectory: {
    configTitle: "未找到大洲地区记录",
    configBody:
      "请在 regions 表中建立 continent 记录，并让 country 记录通过 parent_id 归属大洲。组件不会在前端维护第二份大洲或国家清单。",
    eyebrow: "全球地区目录",
    title: "Markets by",
    titleEm: "continent.",
    description:
      "从 regions 的大洲—国家层级进入公开政策与市场档案。国家代表项按真实公开记录数量排序；没有数据时仍保留目录链接，但不会伪造可用性。",
    summaryLabel: "全球目录公开数据摘要",
    availability: "PUBLIC AVAILABILITY",
    realRecords: "条真实公开记录",
    noRealData: "真实公开数据",
    noneYet: "暂无",
    publishedSignals: "Published Signals",
    publishedMetrics: "Published Metrics",
    demoExcluded: "Demo excluded",
    summaryNote:
      "Signal 仅在 published_at 非空且 review_status=published 时计数；Demo 记录单列，不计入真实可用性。",
    incomplete: (current, expected) =>
      `当前仅从数据库读取到 ${current} / ${expected} 个大洲；未创建前端占位记录。`,
    sectionKicker: "CONTINENT INDEX",
    sectionTitle: "六大洲市场入口",
    sectionHint: "真实数据 · Demo 边界 · 国家目录",
    available: (count) => `${count} 条真实公开记录`,
    demoOnly: "仅有 Demo 记录",
    noData: "暂无真实公开数据",
    enterContinent: "进入大洲档案",
    emptyCountries: "暂无 country 子地区记录",
    representativeCountries: "Representative countries",
    total: (count) => `${count} total`,
    boundaryTitle: "Availability protocol",
    boundaryBody:
      "目录身份和父子关系完全来自 regions。真实可用性排除 is_demo 记录；数值为零只表示已发布记录计数为零，不代表该市场指标值为 0。",
  },
  chinaAtlas: {
    configTitle: "未找到中国地区记录",
    configBody:
      "请传入 regions 表数据并提供中国 country 记录；组件不会在前端创建或猜测省份。",
    eyebrow: "中国省级台账",
    titleProvinces: (count) => `${count} 省级地区`,
    titleEm1: "电力市场",
    titleEm2: "专题矩阵",
    description:
      "七类专题按数据库中的省级专题记录分别展示。每个具体值都保留覆盖状态、原始单位和字段级证据定位。",
    coverageLabel: "已发布专题数据覆盖",
    provincesWithRecords: (withRecords, total) =>
      `${withRecords} / ${total} 省份有发布记录`,
    topicRecords: (count) => `${count} 个发布单元`,
    availableFields: (count) => `${count} 个有值字段`,
    provinceRows: (count) => `${count} 条地区记录`,
    coverageRule:
      "覆盖率按当前专题有无已发布记录计算；“未公布”“不适用”“来源冲突”仍作为明确覆盖状态展示，不会转成 0。",
    topicLedger: "Topic ledger",
    sevenTopics: "七类专题",
    topicTabs: "中国电力市场专题",
    provinceDirectory: "Province directory",
    provinceIndex: "省份索引",
    searchLabel: "搜索省份",
    searchPlaceholder: "搜索省份、代码或 slug…",
    clearSearch: "清除省份搜索",
    provinceList: "中国省级地区",
    fieldStatus: (available, total) =>
      `${available}/${total} 个字段有已核实值`,
    noTopicRecord: "暂无已发布专题记录",
    noMatchingProvinces: "没有匹配的省级地区。",
    legendComplete: "字段完整",
    legendPartial: "已发布但不完整",
    legendNone: "暂无发布记录",
    coverageLegend: "专题覆盖状态图例",
    supportingSignals: "相关 Signal",
    supportingMetrics: "相关指标",
    topicUnit: "专题发布单元",
    noPublishedFields: "当前专题尚无已发布字段值。",
    evidence: "字段证据",
    source: "来源",
    legalStatus: "法律状态",
    operationalStatus: "运行状态",
    effective: "生效",
    asOf: "截至",
    demoBadge: "Demo",
    supportingNote:
      "下方 Signal / Metric 仅作辅助导航，不会推断进七类专题字段。",
  },
};

const en: MessageTree = {
  languageSwitcher: {
    label: "Display language",
    zh: "中文",
    en: "EN",
  },
  demoRibbon:
    "Demo records are for product validation only and do not represent real policy or market conclusions.",
  brandTagline: "Policy × Market Intelligence",
  nav: {
    primary: "Page sections",
    overview: "Overview",
    market: "Market metrics",
    policy: "Policy signals",
    provinceTopics: "Province topics",
    continentMarkets: "Continent markets",
    sections: "Grid Ledger navigation",
  },
  sidebar: {
    publishedRecords: "Published records",
    publishedOnly: "The public view shows published data only",
  },
  regionSelector: {
    label: "Region selector",
    areaDirectory: "Area directory",
    globalWatch: "Global watch",
    continents: "Continent",
    unassignedCountries: "Unassigned countries",
    provinces: "Province",
    ariaCounts: (name, real, demo) =>
      `${name}, ${real} real, ${demo} demo`,
  },
  search: {
    label: "Search published content",
    placeholder: "Search regions, policy, market signals…",
    submit: "Search",
  },
  topbar: {
    dashboard: "Dashboard",
    admin: "ADMIN",
  },
  hero: {
    globalTitle: "Policy moves.",
    globalEm: "Markets answer.",
    regionEm: "policy & market desk.",
    description:
      "Read policy moves and market metrics from published records. Status, dates, regions, and source links stay independent; drafts never enter the public view.",
    realSignals: "Real published signals",
    realMetrics: "Real market metrics",
    demoFixtures: "Demo fixtures",
  },
  mode: {
    label: "Content navigation",
    combined: "Combined view",
    policy: "Policy signals",
    market: "Market metrics",
    provinceTopics: "Province topics",
    continentMarkets: "Continent markets",
    asOf: "DATABASE-BACKED · PUBLISHED ONLY",
  },
  market: {
    kicker: "Published market data",
    title: "Market metrics",
    empty:
      "No published market metrics for this region yet. Missing values are never shown as zero.",
    asOf: (date) => `As of ${date}`,
  },
  status: {
    kicker: "Status ledger",
    title: "Status ledger",
    note: "Filed is not Approved; Draft is not Effective. Status counts include real published records only; Demo is marked separately.",
  },
  policy: {
    kicker: "Published signal feed",
    title: "Policy / market feed",
    empty: "No matching published signals.",
    latest: "Latest signals",
  },
  unnamedRegion: "Unnamed region",
  unspecifiedRegion: "Unspecified region",
  statusLabels: {
    draft: "Draft",
    consultation: "Consultation",
    filed: "Filed",
    approved: "Approved",
    effective: "Effective",
    suspended: "Suspended",
    other: "Other",
  },
  signalDetail: {
    demoRibbon:
      "This record is demo content and does not represent a real policy or market conclusion.",
    homeAria: "Grid Ledger home",
    back: "← Back to dashboard",
    eyebrow: "Intelligence dossier",
    recordInfo: "Record details",
    eventStatus: "Normalized status",
    originalStatus: "Original status",
    eventDate: "Event date",
    effectiveDate: "Effective date",
    impactChannel: "Impact channel",
    directionLevel: "Direction · level",
    humanReview: "Human review",
    reviewStatus: "Review status",
    reviewStatusValue: "Published",
    publishedAt: "Published at",
    evidence: "Evidence trail",
    openOriginal: "OPEN ORIGINAL ↗",
    boundary: "Research boundary",
    boundaryBody: (status) =>
      `This record is shown as “${status}”. Filed, approved, draft, and effective are distinct states; the page never infers or upgrades legal force.`,
  },
  globalDirectory: {
    configTitle: "No continent regions found",
    configBody:
      "Create continent rows in the regions table and attach countries through parent_id. This component does not keep a second hard-coded continent or country list.",
    eyebrow: "Global area ledger",
    title: "Markets by",
    titleEm: "continent.",
    description:
      "Enter published policy and market dossiers from the continent–country hierarchy in regions. Representative countries are ranked by real published records; missing data keeps directory links without fabricating availability.",
    summaryLabel: "Global directory public data summary",
    availability: "PUBLIC AVAILABILITY",
    realRecords: "real published records",
    noRealData: "real published data",
    noneYet: "None",
    publishedSignals: "Published Signals",
    publishedMetrics: "Published Metrics",
    demoExcluded: "Demo excluded",
    summaryNote:
      "Signals count only when published_at is set and review_status=published. Demo records are listed separately and never count as real availability.",
    incomplete: (current, expected) =>
      `Only ${current} / ${expected} continents were read from the database; no frontend placeholders were invented.`,
    sectionKicker: "CONTINENT INDEX",
    sectionTitle: "Six continent market entries",
    sectionHint: "Real data · Demo boundary · Country directory",
    available: (count) => `${count} real published records`,
    demoOnly: "Demo records only",
    noData: "No real published data yet",
    enterContinent: "Open continent dossier",
    emptyCountries: "No country child regions yet",
    representativeCountries: "Representative countries",
    total: (count) => `${count} total`,
    boundaryTitle: "Availability protocol",
    boundaryBody:
      "Directory identity and parent/child links come only from regions. Real availability excludes is_demo records; a zero count means zero published records, not a market metric value of 0.",
  },
  chinaAtlas: {
    configTitle: "China region record not found",
    configBody:
      "Pass regions table data that includes the China country row. This component never invents or guesses provinces.",
    eyebrow: "China provincial ledger",
    titleProvinces: (count) => `${count} provinces`,
    titleEm1: "Power market",
    titleEm2: "topic matrix",
    description:
      "The seven topics render only from published province-topic records. Each value keeps coverage status, original units, and field-level evidence.",
    coverageLabel: "Published topic coverage",
    provincesWithRecords: (withRecords, total) =>
      `${withRecords} / ${total} provinces have published records`,
    topicRecords: (count) => `${count} published units`,
    availableFields: (count) => `${count} valued fields`,
    provinceRows: (count) => `${count} region rows`,
    coverageRule:
      "Coverage is based on whether the active topic has a published record. “Not published”, “not applicable”, and “conflicting” remain explicit coverage states and are never coerced to 0.",
    topicLedger: "Topic ledger",
    sevenTopics: "Seven topics",
    topicTabs: "China power market topics",
    provinceDirectory: "Province directory",
    provinceIndex: "Province index",
    searchLabel: "Search provinces",
    searchPlaceholder: "Search province, code, or slug…",
    clearSearch: "Clear province search",
    provinceList: "China provinces",
    fieldStatus: (available, total) =>
      `${available}/${total} fields have verified values`,
    noTopicRecord: "No published topic record yet",
    noMatchingProvinces: "No matching provinces.",
    legendComplete: "Complete fields",
    legendPartial: "Published but incomplete",
    legendNone: "No published record",
    coverageLegend: "Topic coverage legend",
    supportingSignals: "Related signals",
    supportingMetrics: "Related metrics",
    topicUnit: "Topic publish unit",
    noPublishedFields: "This topic has no published field values yet.",
    evidence: "Field evidence",
    source: "Source",
    legalStatus: "Legal status",
    operationalStatus: "Operational status",
    effective: "Effective",
    asOf: "As of",
    demoBadge: "Demo",
    supportingNote:
      "Signals / metrics below are supporting navigation only and are never inferred into the seven topic fields.",
  },
};

export const messages: Record<DisplayLocale, MessageTree> = {
  "zh-CN": zhCN,
  en,
};

export function getMessages(locale: DisplayLocale): MessageTree {
  return messages[locale] ?? messages["zh-CN"];
}
