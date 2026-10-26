-- Rodin Hub: people, events, briefs and notes, with row-level security by role.

create table if not exists public.rh_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'driver' check (role in ('coach','driver','engineer','trainer')),
  driver_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.rh_series (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.rh_drivers (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.rh_series(id) on delete set null,
  car_no text not null default '',
  full_name text not null,
  nat text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.rh_profiles
  drop constraint if exists rh_profiles_driver_fk,
  add constraint rh_profiles_driver_fk foreign key (driver_id) references public.rh_drivers(id) on delete set null;

create table if not exists public.rh_engineer_drivers (
  engineer_id uuid not null references public.rh_profiles(id) on delete cascade,
  driver_id uuid not null references public.rh_drivers(id) on delete cascade,
  primary key (engineer_id, driver_id)
);

create table if not exists public.rh_events (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.rh_series(id) on delete set null,
  kind text not null default 'test' check (kind in ('test','race','sim')),
  name text not null,
  location text not null default '',
  track text not null default '',
  track_info text not null default '',
  date_from date,
  date_to date,
  sessions jsonb not null default '[]'::jsonb,   -- [{key,label,day,date,time}]
  prev_event_id uuid references public.rh_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.rh_briefs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.rh_events(id) on delete cascade,
  driver_id uuid not null references public.rh_drivers(id) on delete cascade,
  kind text not null check (kind in ('pre','event','post')),
  data jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','sent')),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  unique (event_id, driver_id, kind)
);

create table if not exists public.rh_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.rh_events(id) on delete cascade,
  driver_id uuid not null references public.rh_drivers(id) on delete cascade,
  session_key text,
  author_id uuid references auth.users(id) on delete set null default auth.uid(),
  author_role text not null default 'coach',
  source text not null default 'coach' check (source in ('fact','driver','coach','check')),
  body text not null default '',
  tags text[] not null default '{}',
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists rh_briefs_event_idx on public.rh_briefs(event_id);
create index if not exists rh_briefs_driver_idx on public.rh_briefs(driver_id);
create index if not exists rh_notes_event_driver_idx on public.rh_notes(event_id, driver_id);
create index if not exists rh_drivers_series_idx on public.rh_drivers(series_id);
create index if not exists rh_events_series_idx on public.rh_events(series_id);
create index if not exists rh_events_prev_idx on public.rh_events(prev_event_id);
create index if not exists rh_profiles_driver_idx on public.rh_profiles(driver_id);
create index if not exists rh_engineer_drivers_driver_idx on public.rh_engineer_drivers(driver_id);
create index if not exists rh_notes_author_idx on public.rh_notes(author_id);
create index if not exists rh_briefs_updated_by_idx on public.rh_briefs(updated_by);

-- helpers (security definer so policies can read profiles without recursion)
create or replace function public.rh_my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.rh_profiles where id = (select auth.uid())
$$;
create or replace function public.rh_my_driver_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select driver_id from public.rh_profiles where id = (select auth.uid())
$$;
create or replace function public.rh_can_see_driver(d uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.rh_profiles p where p.id = (select auth.uid()) and (
      p.role in ('coach','trainer') or p.driver_id = d
      or (p.role = 'engineer' and exists (select 1 from public.rh_engineer_drivers ed where ed.engineer_id = p.id and ed.driver_id = d))))
$$;
revoke execute on function public.rh_my_role(), public.rh_my_driver_id(), public.rh_can_see_driver(uuid) from anon, public;
grant execute on function public.rh_my_role(), public.rh_my_driver_id(), public.rh_can_see_driver(uuid) to authenticated;

-- keep updated_at / updated_by fresh
create or replace function public.rh_touch_brief() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists rh_briefs_touch on public.rh_briefs;
create trigger rh_briefs_touch before insert or update on public.rh_briefs for each row execute function public.rh_touch_brief();

alter table public.rh_profiles enable row level security;
alter table public.rh_series enable row level security;
alter table public.rh_drivers enable row level security;
alter table public.rh_engineer_drivers enable row level security;
alter table public.rh_events enable row level security;
alter table public.rh_briefs enable row level security;
alter table public.rh_notes enable row level security;

-- profiles: see yourself; coach sees everyone
create policy rh_profiles_read on public.rh_profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.rh_my_role()) = 'coach');
create policy rh_profiles_coach_write_ins on public.rh_profiles for insert to authenticated with check ((select public.rh_my_role()) = 'coach');
create policy rh_profiles_coach_write_upd on public.rh_profiles for update to authenticated using ((select public.rh_my_role()) = 'coach') with check ((select public.rh_my_role()) = 'coach');
create policy rh_profiles_coach_write_del on public.rh_profiles for delete to authenticated using ((select public.rh_my_role()) = 'coach');

-- reference data: everyone signed in reads; coach writes
create policy rh_series_read on public.rh_series for select to authenticated using (true);
create policy rh_series_write_ins on public.rh_series for insert to authenticated with check ((select public.rh_my_role()) = 'coach');
create policy rh_series_write_upd on public.rh_series for update to authenticated using ((select public.rh_my_role()) = 'coach') with check ((select public.rh_my_role()) = 'coach');
create policy rh_series_write_del on public.rh_series for delete to authenticated using ((select public.rh_my_role()) = 'coach');
create policy rh_events_read on public.rh_events for select to authenticated using (true);
create policy rh_events_write_ins on public.rh_events for insert to authenticated with check ((select public.rh_my_role()) = 'coach');
create policy rh_events_write_upd on public.rh_events for update to authenticated using ((select public.rh_my_role()) = 'coach') with check ((select public.rh_my_role()) = 'coach');
create policy rh_events_write_del on public.rh_events for delete to authenticated using ((select public.rh_my_role()) = 'coach');
create policy rh_drivers_read on public.rh_drivers for select to authenticated using ((select public.rh_can_see_driver(id)));
create policy rh_drivers_write_ins on public.rh_drivers for insert to authenticated with check ((select public.rh_my_role()) = 'coach');
create policy rh_drivers_write_upd on public.rh_drivers for update to authenticated using ((select public.rh_my_role()) = 'coach') with check ((select public.rh_my_role()) = 'coach');
create policy rh_drivers_write_del on public.rh_drivers for delete to authenticated using ((select public.rh_my_role()) = 'coach');
create policy rh_engdrv_read on public.rh_engineer_drivers for select to authenticated
  using (engineer_id = (select auth.uid()) or (select public.rh_my_role()) = 'coach');
create policy rh_engdrv_write_ins on public.rh_engineer_drivers for insert to authenticated with check ((select public.rh_my_role()) = 'coach');
create policy rh_engdrv_write_upd on public.rh_engineer_drivers for update to authenticated using ((select public.rh_my_role()) = 'coach') with check ((select public.rh_my_role()) = 'coach');
create policy rh_engdrv_write_del on public.rh_engineer_drivers for delete to authenticated using ((select public.rh_my_role()) = 'coach');

-- briefs: a driver reads/writes their own; coach everything; engineer & trainer read their drivers
create policy rh_briefs_read on public.rh_briefs for select to authenticated using ((select public.rh_can_see_driver(driver_id)));
create policy rh_briefs_insert on public.rh_briefs for insert to authenticated
  with check ((select public.rh_my_role()) = 'coach' or driver_id = (select public.rh_my_driver_id()));
create policy rh_briefs_update on public.rh_briefs for update to authenticated
  using ((select public.rh_my_role()) = 'coach' or driver_id = (select public.rh_my_driver_id()))
  with check ((select public.rh_my_role()) = 'coach' or driver_id = (select public.rh_my_driver_id()));
create policy rh_briefs_delete on public.rh_briefs for delete to authenticated using ((select public.rh_my_role()) = 'coach');

-- notes: coach sees all; others see their own notes plus 'fact' notes for drivers they can see
create policy rh_notes_read on public.rh_notes for select to authenticated using (
  (select public.rh_my_role()) = 'coach' or author_id = (select auth.uid())
  or (source = 'fact' and (select public.rh_can_see_driver(driver_id))));
create policy rh_notes_insert on public.rh_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and (select public.rh_can_see_driver(driver_id)));
create policy rh_notes_update on public.rh_notes for update to authenticated
  using (author_id = (select auth.uid()) or (select public.rh_my_role()) = 'coach')
  with check (author_id = (select auth.uid()) or (select public.rh_my_role()) = 'coach');
create policy rh_notes_delete on public.rh_notes for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.rh_my_role()) = 'coach');

-- 2026-10-26: engineers see only briefs their drivers have sent; drivers see their engineers' names
alter policy rh_briefs_read on public.rh_briefs using (
  (select public.rh_my_role()) = 'coach'
  or driver_id = (select public.rh_my_driver_id())
  or (status = 'sent' and (select public.rh_can_see_driver(driver_id))));
create or replace function public.rh_driver_engineers(d uuid) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(split_part(p.full_name,' ',1), ' & ' order by p.full_name)
  from public.rh_engineer_drivers ed join public.rh_profiles p on p.id = ed.engineer_id
  where ed.driver_id = d and public.rh_can_see_driver(d)
$$;
revoke execute on function public.rh_driver_engineers(uuid) from anon, public;
grant execute on function public.rh_driver_engineers(uuid) to authenticated;

-- 2026-10-26: official timing per session (auto-fills lap time / gap / position, best-laps card)
create table if not exists public.rh_timing (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.rh_events(id) on delete cascade,
  session_key text not null,
  rows jsonb not null default '[]'::jsonb,  -- [{pos,no,name,team,best,gap,laps}]
  source text not null default '',
  updated_at timestamptz not null default now(),
  unique (event_id, session_key)
);
alter table public.rh_timing enable row level security;
create policy rh_timing_read on public.rh_timing for select to authenticated using (true);
create policy rh_timing_ins on public.rh_timing for insert to authenticated with check ((select public.rh_my_role()) = 'coach');
create policy rh_timing_upd on public.rh_timing for update to authenticated using ((select public.rh_my_role()) = 'coach') with check ((select public.rh_my_role()) = 'coach');
grant select, insert, update on public.rh_timing to authenticated;
