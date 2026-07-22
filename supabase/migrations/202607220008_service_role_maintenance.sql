-- Supabase's service_role bypasses RLS but still needs SQL table privileges.
-- The application never uses this key; these grants support trusted local test
-- cleanup, backups, and operator maintenance without weakening anon/authenticated
-- policies.

grant usage on schema public to service_role;
grant select, insert, update, delete
  on public.regions,
     public.signals,
     public.market_metrics,
     public.import_jobs,
     public.import_items
  to service_role;
