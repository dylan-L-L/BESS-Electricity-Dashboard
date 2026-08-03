-- Extend policy ingest whitelist with industry media / association list pages.
-- Official gazettes keep higher priority; these feeds are explicit additions only.

insert into public.policy_source_feeds (
  id, region_slug, name, list_url, source_name, language, enabled, priority, notes
)
values
  (
    '10000000-0000-4000-8000-000000000080',
    'china',
    'ESZoneo — Policy Updates',
    'https://eszoneo.com/intel/policy-updates',
    'ESZoneo',
    'zh',
    true,
    45,
    '行业媒体政策汇总；硬过滤应跳过解读/盘点类，仅保留正式政策转载。'
  ),
  (
    '10000000-0000-4000-8000-000000000081',
    'china',
    'ESS News — Markets / Policy',
    'https://www.ess-news.com/category/markets/policy/',
    'ESS News',
    'en',
    true,
    44,
    '储能行业媒体政策栏目；项目宣传与评论稿应 skip。'
  ),
  (
    '10000000-0000-4000-8000-000000000082',
    'china',
    '中国储能网 — 政策法规',
    'https://www.escn.com.cn/news/564.html',
    '中国储能网',
    'zh',
    true,
    43,
    '行业门户政策法规栏目；优先保留原文链接可核验的通知/办法。'
  ),
  (
    '10000000-0000-4000-8000-000000000083',
    'guangdong',
    '广东省储能行业协会 — 政策列表',
    'https://www.gdshe.org/list/7.html',
    '广东省储能行业协会',
    'zh',
    true,
    42,
    '省级行业协会政策列表；归属广东省份目录。'
  ),
  (
    '10000000-0000-4000-8000-000000000084',
    'global',
    'Energy-Storage.News — Policy subjects',
    'https://www.energy-storage.news/premium/content/?jsf=jet-engine&tax=subjects:435',
    'Energy-Storage.News',
    'en',
    true,
    40,
    '全球储能媒体政策专题；premium 列表可能需可公开抓取的条目才入库。'
  ),
  (
    '10000000-0000-4000-8000-000000000085',
    'usa',
    'Utility Dive — Storage',
    'https://www.utilitydive.com/topic/storage/',
    'Utility Dive',
    'en',
    true,
    40,
    '美国电力媒体储能专题；仅保留监管/规则类，跳过公司新闻与观点稿。'
  )
on conflict (id) do update
set
  region_slug = excluded.region_slug,
  name = excluded.name,
  list_url = excluded.list_url,
  source_name = excluded.source_name,
  language = excluded.language,
  enabled = excluded.enabled,
  priority = excluded.priority,
  notes = excluded.notes,
  updated_at = now();
