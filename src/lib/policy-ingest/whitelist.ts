/**
 * Starter source whitelist for BESS-active markets.
 * Prefer official policy list / gazette pages; industry media list pages may
 * be added explicitly when requested. Never open-web search.
 * Replace or extend after reviewing monthly brief samples.
 */
export type WhitelistFeedSeed = {
  id: string;
  region_slug: string;
  name: string;
  list_url: string;
  source_name: string;
  language: string;
  priority: number;
  notes?: string;
};

export const POLICY_SOURCE_FEED_SEEDS: readonly WhitelistFeedSeed[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    region_slug: "china",
    name: "国家能源局 — 政策法规",
    list_url: "https://www.nea.gov.cn/policy/index.htm",
    source_name: "国家能源局",
    language: "zh",
    priority: 100,
    notes: "中国国家级能源政策主入口；抓取前请确认栏目 URL 仍有效。",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    region_slug: "china",
    name: "国家发展改革委 — 政策发布",
    list_url: "https://www.ndrc.gov.cn/xxgk/zcfb/",
    source_name: "国家发展改革委",
    language: "zh",
    priority: 95,
  },
  {
    id: "10000000-0000-4000-8000-000000000010",
    region_slug: "india",
    name: "Ministry of Power — Notices",
    list_url: "https://powermin.gov.in/en/content/notices",
    source_name: "Ministry of Power (India)",
    language: "en",
    priority: 80,
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    region_slug: "india",
    name: "CERC — Orders / Regulations",
    list_url: "https://cercind.gov.in/orders.html",
    source_name: "CERC",
    language: "en",
    priority: 75,
  },
  {
    id: "10000000-0000-4000-8000-000000000020",
    region_slug: "malaysia",
    name: "Energy Commission Malaysia — Announcements",
    list_url: "https://www.st.gov.my/en/web/consumer/details/2/8",
    source_name: "Suruhanjaya Tenaga",
    language: "en",
    priority: 60,
  },
  {
    id: "10000000-0000-4000-8000-000000000021",
    region_slug: "indonesia",
    name: "Ministry of Energy and Mineral Resources — Regulations",
    list_url: "https://www.esdm.go.id/en/regulation",
    source_name: "ESDM",
    language: "en",
    priority: 60,
  },
  {
    id: "10000000-0000-4000-8000-000000000030",
    region_slug: "australia",
    name: "AEMC — Rules & determinations",
    list_url: "https://www.aemc.gov.au/rule-changes",
    source_name: "AEMC",
    language: "en",
    priority: 70,
  },
  {
    id: "10000000-0000-4000-8000-000000000031",
    region_slug: "australia",
    name: "AEMO — Market notices",
    list_url: "https://aemo.com.au/market-notices",
    source_name: "AEMO",
    language: "en",
    priority: 65,
  },
  {
    id: "10000000-0000-4000-8000-000000000040",
    region_slug: "south-korea",
    name: "MOTIE — Press / Policy",
    list_url: "https://english.motie.go.kr/en/pc/pressreleases/bbs/bbsList.do?bbs_cd_n=2",
    source_name: "MOTIE",
    language: "en",
    priority: 55,
  },
  {
    id: "10000000-0000-4000-8000-000000000041",
    region_slug: "japan",
    name: "METI — News Releases",
    list_url: "https://www.meti.go.jp/english/press/index.html",
    source_name: "METI",
    language: "en",
    priority: 55,
  },
  {
    id: "10000000-0000-4000-8000-000000000050",
    region_slug: "united-kingdom",
    name: "OFGEM — Publications",
    list_url: "https://www.ofgem.gov.uk/publications",
    source_name: "OFGEM",
    language: "en",
    priority: 70,
  },
  {
    id: "10000000-0000-4000-8000-000000000051",
    region_slug: "germany",
    name: "Bundesnetzagentur — Decisions",
    list_url: "https://www.bundesnetzagentur.de/EN/RulingChambers/Decisions/start.html",
    source_name: "BNetzA",
    language: "en",
    priority: 60,
  },
  {
    id: "10000000-0000-4000-8000-000000000060",
    region_slug: "usa",
    name: "FERC — News & Notices",
    list_url: "https://www.ferc.gov/news-events/news",
    source_name: "FERC",
    language: "en",
    priority: 80,
  },
  {
    id: "10000000-0000-4000-8000-000000000061",
    region_slug: "usa",
    name: "DOE — Energy Storage newsroom",
    list_url: "https://www.energy.gov/oe/articles",
    source_name: "U.S. DOE",
    language: "en",
    priority: 65,
    notes: "仅收录正式规则/指令类；项目宣传稿应 skip。",
  },
  {
    id: "10000000-0000-4000-8000-000000000062",
    region_slug: "canada",
    name: "CER — Regulatory documents",
    list_url: "https://www.cer-rec.gc.ca/en/about/news-room/news-releases/index.html",
    source_name: "CER",
    language: "en",
    priority: 50,
  },
  {
    id: "10000000-0000-4000-8000-000000000070",
    region_slug: "mexico",
    name: "CRE — Acuerdos",
    list_url: "https://www.gob.mx/cre/archivo/acciones_y_programas",
    source_name: "CRE",
    language: "es",
    priority: 50,
  },
  {
    id: "10000000-0000-4000-8000-000000000071",
    region_slug: "chile",
    name: "CNE Chile — Normativa",
    list_url: "https://www.cne.cl/normativas/",
    source_name: "CNE",
    language: "es",
    priority: 55,
  },
  {
    id: "10000000-0000-4000-8000-000000000072",
    region_slug: "brazil",
    name: "ANEEL — Resoluções",
    list_url: "https://www.gov.br/aneel/pt-br/assuntos/noticias",
    source_name: "ANEEL",
    language: "pt",
    priority: 55,
  },

  // Industry media / association list pages (explicit whitelist only).
  // Priority sits below official gazettes so regulators win the weekly quota.
  {
    id: "10000000-0000-4000-8000-000000000080",
    region_slug: "china",
    name: "ESZoneo — Policy Updates",
    list_url: "https://eszoneo.com/intel/policy-updates",
    source_name: "ESZoneo",
    language: "zh",
    priority: 45,
    notes: "行业媒体政策汇总；硬过滤应跳过解读/盘点类，仅保留正式政策转载。",
  },
  {
    id: "10000000-0000-4000-8000-000000000081",
    region_slug: "china",
    name: "ESS News — Markets / Policy",
    list_url: "https://www.ess-news.com/category/markets/policy/",
    source_name: "ESS News",
    language: "en",
    priority: 44,
    notes: "储能行业媒体政策栏目；项目宣传与评论稿应 skip。",
  },
  {
    id: "10000000-0000-4000-8000-000000000082",
    region_slug: "china",
    name: "中国储能网 — 政策法规",
    list_url: "https://www.escn.com.cn/news/564.html",
    source_name: "中国储能网",
    language: "zh",
    priority: 43,
    notes: "行业门户政策法规栏目；优先保留原文链接可核验的通知/办法。",
  },
  {
    id: "10000000-0000-4000-8000-000000000083",
    region_slug: "guangdong",
    name: "广东省储能行业协会 — 政策列表",
    list_url: "https://www.gdshe.org/list/7.html",
    source_name: "广东省储能行业协会",
    language: "zh",
    priority: 42,
    notes: "省级行业协会政策列表；归属广东省份目录。",
  },
  {
    id: "10000000-0000-4000-8000-000000000084",
    region_slug: "global",
    name: "Energy-Storage.News — Policy subjects",
    list_url:
      "https://www.energy-storage.news/premium/content/?jsf=jet-engine&tax=subjects:435",
    source_name: "Energy-Storage.News",
    language: "en",
    priority: 40,
    notes: "全球储能媒体政策专题；premium 列表可能需可公开抓取的条目才入库。",
  },
  {
    id: "10000000-0000-4000-8000-000000000085",
    region_slug: "usa",
    name: "Utility Dive — Storage",
    list_url: "https://www.utilitydive.com/topic/storage/",
    source_name: "Utility Dive",
    language: "en",
    priority: 40,
    notes: "美国电力媒体储能专题；仅保留监管/规则类，跳过公司新闻与观点稿。",
  },
];

export function feedsGroupedByRegion(): Record<string, WhitelistFeedSeed[]> {
  const grouped: Record<string, WhitelistFeedSeed[]> = {};
  for (const feed of POLICY_SOURCE_FEED_SEEDS) {
    const bucket = grouped[feed.region_slug] ?? [];
    bucket.push(feed);
    grouped[feed.region_slug] = bucket;
  }
  return grouped;
}
