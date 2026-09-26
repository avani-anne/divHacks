-- NYC Green Space Planner: database schema for Supabase.
-- Paste into Supabase → SQL Editor → New query, then press Run. Safe to re-run.

-- ============================================================
-- Profiles: one per login, created automatically at sign-up.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text,
  zip text check (zip ~ '^\d{5}$'),
  follows text[] not null default '{}',
  volunteer jsonb,
  notify jsonb not null default '{"projects": true, "petitions": true, "reminders": true, "replies": true}',
  updates_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, zip, follows)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'zip', ''),
    case when coalesce(new.raw_user_meta_data->>'zip', '') ~ '^\d{5}$'
         then array[new.raw_user_meta_data->>'zip'] else '{}' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- How many people follow a ZIP (without exposing who they are).
create or replace function public.followers_count(z text)
returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int from public.profiles where z = any(follows);
$$;

-- ============================================================
-- Saved green-space proposals (private to their owner).
-- ============================================================
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  zip text not null,
  lat double precision not null,
  lng double precision not null,
  name text not null check (char_length(name) <= 120),
  type text not null,
  notes text not null default '' check (char_length(notes) <= 2000),
  saved_at timestamptz not null default now()
);

-- ============================================================
-- Petitions and volunteer projects (public).
-- ============================================================
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('petition', 'project')),
  title text not null check (char_length(title) between 3 and 120),
  site_type text,
  zip text not null check (zip ~ '^\d{5}$'),
  location text,
  description text not null check (char_length(description) <= 4000),
  target text,
  goal integer check (goal is null or goal between 1 and 1000000),
  date date,
  needed integer check (needed is null or needed between 1 and 10000),
  lat double precision,
  lng double precision,
  organizer_id uuid not null default auth.uid() references auth.users on delete cascade,
  organizer_name text,
  created_at timestamptz not null default now()
);
create index if not exists items_zip_idx on public.items (zip);

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (item_id, user_id)          -- one signature per account
);

create table if not exists public.volunteers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)          -- one sign-up per account
);

-- Volunteer contact details are only visible to the volunteer and the project organizer.
create table if not exists public.volunteer_contacts (
  item_id uuid not null references public.items on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  contact text not null check (char_length(contact) <= 200),
  primary key (item_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_item_idx on public.messages (item_id, created_at);

-- Author names always come from the signed-in user's profile, never from the client.
create or replace function public.stamp_author()
returns trigger language plpgsql security definer set search_path = public as $$
declare author text;
begin
  select name into author from public.profiles where id = auth.uid();
  if tg_table_name = 'items' then
    new.organizer_id := auth.uid();
    new.organizer_name := author;
  else
    new.user_id := auth.uid();
    new.name := author;
  end if;
  return new;
end $$;

drop trigger if exists stamp_items on public.items;
create trigger stamp_items before insert on public.items for each row execute function public.stamp_author();
drop trigger if exists stamp_signatures on public.signatures;
create trigger stamp_signatures before insert on public.signatures for each row execute function public.stamp_author();
drop trigger if exists stamp_volunteers on public.volunteers;
create trigger stamp_volunteers before insert on public.volunteers for each row execute function public.stamp_author();
drop trigger if exists stamp_messages on public.messages;
create trigger stamp_messages before insert on public.messages for each row execute function public.stamp_author();

-- ============================================================
-- Row-level security: who can read and write what.
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.proposals          enable row level security;
alter table public.items              enable row level security;
alter table public.signatures         enable row level security;
alter table public.volunteers         enable row level security;
alter table public.volunteer_contacts enable row level security;
alter table public.messages           enable row level security;

-- Profiles: you can read and edit only your own.
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Proposals: private to the owner.
drop policy if exists "own proposals" on public.proposals;
create policy "own proposals" on public.proposals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Items: anyone can read; logged-in users can create; organizers can edit or delete their own.
drop policy if exists "items readable" on public.items;
create policy "items readable" on public.items for select using (true);
drop policy if exists "items insert" on public.items;
create policy "items insert" on public.items for insert to authenticated with check (organizer_id = auth.uid());
drop policy if exists "items organizer update" on public.items;
create policy "items organizer update" on public.items for update to authenticated using (organizer_id = auth.uid());
drop policy if exists "items organizer delete" on public.items;
create policy "items organizer delete" on public.items for delete to authenticated using (organizer_id = auth.uid());

-- Signatures: public; sign once as yourself; no editing.
drop policy if exists "signatures readable" on public.signatures;
create policy "signatures readable" on public.signatures for select using (true);
drop policy if exists "signatures insert own" on public.signatures;
create policy "signatures insert own" on public.signatures for insert to authenticated with check (user_id = auth.uid());

-- Volunteers: public names; join once as yourself; you can leave.
drop policy if exists "volunteers readable" on public.volunteers;
create policy "volunteers readable" on public.volunteers for select using (true);
drop policy if exists "volunteers insert own" on public.volunteers;
create policy "volunteers insert own" on public.volunteers for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "volunteers delete own" on public.volunteers;
create policy "volunteers delete own" on public.volunteers for delete to authenticated using (user_id = auth.uid());

-- Volunteer contacts: you and the project's organizer only.
drop policy if exists "contacts read" on public.volunteer_contacts;
create policy "contacts read" on public.volunteer_contacts for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from public.items i where i.id = item_id and i.organizer_id = auth.uid())
);
drop policy if exists "contacts insert own" on public.volunteer_contacts;
create policy "contacts insert own" on public.volunteer_contacts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "contacts delete own" on public.volunteer_contacts;
create policy "contacts delete own" on public.volunteer_contacts for delete to authenticated using (user_id = auth.uid());

-- Messages: public; post as yourself.
drop policy if exists "messages readable" on public.messages;
create policy "messages readable" on public.messages for select using (true);
drop policy if exists "messages insert own" on public.messages;
create policy "messages insert own" on public.messages for insert to authenticated with check (user_id = auth.uid());
