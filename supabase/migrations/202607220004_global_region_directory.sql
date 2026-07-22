-- Demo/reference geography only. No policy, price, tariff, or market metric is
-- created by this migration.

insert into public.regions (
  id, slug, code, name_zh, name_en, region_type, parent_id, is_demo
)
values
  ('00000000-0000-4000-8000-000000000101', 'asia', 'CONT-AS', '亚洲', 'Asia', 'continent', '00000000-0000-4000-8000-000000000001', true),
  ('00000000-0000-4000-8000-000000000102', 'europe', 'CONT-EU', '欧洲', 'Europe', 'continent', '00000000-0000-4000-8000-000000000001', true),
  ('00000000-0000-4000-8000-000000000103', 'north-america', 'CONT-NA', '北美洲', 'North America', 'continent', '00000000-0000-4000-8000-000000000001', true),
  ('00000000-0000-4000-8000-000000000104', 'south-america', 'CONT-SA', '南美洲', 'South America', 'continent', '00000000-0000-4000-8000-000000000001', true),
  ('00000000-0000-4000-8000-000000000105', 'oceania', 'CONT-OC', '大洋洲', 'Oceania', 'continent', '00000000-0000-4000-8000-000000000001', true),
  ('00000000-0000-4000-8000-000000000106', 'africa', 'CONT-AF', '非洲', 'Africa', 'continent', '00000000-0000-4000-8000-000000000001', true)
on conflict (id) do update
set
  slug = excluded.slug,
  code = excluded.code,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  region_type = excluded.region_type,
  parent_id = excluded.parent_id,
  is_demo = excluded.is_demo;

insert into public.regions (
  id, slug, code, name_zh, name_en, region_type, parent_id, is_demo
)
values
  ('00000000-0000-4000-8000-000000000002', 'china', 'CN', '中国', 'China', 'country', '00000000-0000-4000-8000-000000000101', true),
  ('00000000-0000-4000-8000-000000000009', 'japan', 'JP', '日本', 'Japan', 'country', '00000000-0000-4000-8000-000000000101', true),
  ('00000000-0000-4000-8000-000000000201', 'south-korea', 'KR', '韩国', 'South Korea', 'country', '00000000-0000-4000-8000-000000000101', true),
  ('00000000-0000-4000-8000-000000000202', 'india', 'IN', '印度', 'India', 'country', '00000000-0000-4000-8000-000000000101', true),
  ('00000000-0000-4000-8000-000000000203', 'singapore', 'SG', '新加坡', 'Singapore', 'country', '00000000-0000-4000-8000-000000000101', true),
  ('00000000-0000-4000-8000-000000000008', 'germany', 'DE', '德国', 'Germany', 'country', '00000000-0000-4000-8000-000000000102', true),
  ('00000000-0000-4000-8000-000000000204', 'united-kingdom', 'GB', '英国', 'United Kingdom', 'country', '00000000-0000-4000-8000-000000000102', true),
  ('00000000-0000-4000-8000-000000000205', 'france', 'FR', '法国', 'France', 'country', '00000000-0000-4000-8000-000000000102', true),
  ('00000000-0000-4000-8000-000000000206', 'spain', 'ES', '西班牙', 'Spain', 'country', '00000000-0000-4000-8000-000000000102', true),
  ('00000000-0000-4000-8000-000000000207', 'italy', 'IT', '意大利', 'Italy', 'country', '00000000-0000-4000-8000-000000000102', true),
  ('00000000-0000-4000-8000-000000000208', 'netherlands', 'NL', '荷兰', 'Netherlands', 'country', '00000000-0000-4000-8000-000000000102', true),
  ('00000000-0000-4000-8000-000000000006', 'usa', 'US', '美国', 'United States', 'country', '00000000-0000-4000-8000-000000000103', true),
  ('00000000-0000-4000-8000-000000000209', 'canada', 'CA', '加拿大', 'Canada', 'country', '00000000-0000-4000-8000-000000000103', true),
  ('00000000-0000-4000-8000-000000000210', 'mexico', 'MX', '墨西哥', 'Mexico', 'country', '00000000-0000-4000-8000-000000000103', true),
  ('00000000-0000-4000-8000-000000000010', 'chile', 'CL', '智利', 'Chile', 'country', '00000000-0000-4000-8000-000000000104', true),
  ('00000000-0000-4000-8000-000000000211', 'brazil', 'BR', '巴西', 'Brazil', 'country', '00000000-0000-4000-8000-000000000104', true),
  ('00000000-0000-4000-8000-000000000212', 'argentina', 'AR', '阿根廷', 'Argentina', 'country', '00000000-0000-4000-8000-000000000104', true),
  ('00000000-0000-4000-8000-000000000213', 'colombia', 'CO', '哥伦比亚', 'Colombia', 'country', '00000000-0000-4000-8000-000000000104', true),
  ('00000000-0000-4000-8000-000000000007', 'australia', 'AU', '澳大利亚', 'Australia', 'country', '00000000-0000-4000-8000-000000000105', true),
  ('00000000-0000-4000-8000-000000000214', 'new-zealand', 'NZ', '新西兰', 'New Zealand', 'country', '00000000-0000-4000-8000-000000000105', true),
  ('00000000-0000-4000-8000-000000000215', 'south-africa', 'ZA', '南非', 'South Africa', 'country', '00000000-0000-4000-8000-000000000106', true),
  ('00000000-0000-4000-8000-000000000216', 'egypt', 'EG', '埃及', 'Egypt', 'country', '00000000-0000-4000-8000-000000000106', true),
  ('00000000-0000-4000-8000-000000000217', 'morocco', 'MA', '摩洛哥', 'Morocco', 'country', '00000000-0000-4000-8000-000000000106', true),
  ('00000000-0000-4000-8000-000000000218', 'kenya', 'KE', '肯尼亚', 'Kenya', 'country', '00000000-0000-4000-8000-000000000106', true)
on conflict (id) do update
set
  slug = excluded.slug,
  code = excluded.code,
  name_zh = excluded.name_zh,
  name_en = excluded.name_en,
  region_type = excluded.region_type,
  parent_id = excluded.parent_id,
  is_demo = excluded.is_demo;
