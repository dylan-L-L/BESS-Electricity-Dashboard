-- PostgreSQL requires a newly added enum value to be committed before another
-- migration can use it. Keep this enum-only migration separate from region data.

alter type public.region_type add value if not exists 'continent' after 'global';
