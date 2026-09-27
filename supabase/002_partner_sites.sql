-- Partner sites: link a petition or project to a school, senior center, nursing home,
-- homeless-services site or food program from NYC's Facilities Database.
-- Paste into Supabase → SQL Editor and press Run. Safe to re-run.

alter table public.items add column if not exists partner_uid text;
alter table public.items add column if not exists partner_name text;
alter table public.items add column if not exists partner_kind text;
alter table public.items add column if not exists partner_address text;

create index if not exists items_partner_idx on public.items (partner_uid);
