-- Text alerts: a log of texts sent by the send-welcome-sms Edge Function, used to rate-limit it.
-- Paste into Supabase → SQL Editor and press Run. Safe to re-run.

create table if not exists public.sms_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  phone_last4 text,
  zip text,
  twilio_sid text,
  sent_at timestamptz not null default now()
);
create index if not exists sms_log_user_idx on public.sms_log (user_id, sent_at);

-- Only the Edge Function (service role) reads and writes this table; no browser access.
alter table public.sms_log enable row level security;
