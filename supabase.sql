-- GrowMyPin Studio: free growth reports
-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.growth_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text,
  whatsapp text,
  shop_url text not null,
  pinterest_url text,
  product_note text,
  niche text,
  country text,
  status text not null default 'queued',      -- queued, processing, ready, failed
  attempts int not null default 0,
  ready_at timestamptz not null,               -- when the user is allowed to see it
  created_at timestamptz not null default now(),
  generated_at timestamptz,
  emailed_at timestamptz,
  history jsonb,                               -- daily Pinterest impressions, if connected
  result jsonb,                                -- the AI report
  error text
);

create index if not exists growth_reports_user_idx on public.growth_reports (user_id, created_at desc);
create index if not exists growth_reports_status_idx on public.growth_reports (status, ready_at);

-- Lock the table: only the server (service key) can read or write it.
alter table public.growth_reports enable row level security;

-- =====================================================================
-- v1.1  Signup funnel, Diwali offer, visitor stats, admin panel, messages
-- Safe to run again (everything is "if not exists" / "or replace").
-- =====================================================================

-- One row per GrowMyPin account (filled on signup / login).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  phone text,
  offer_status text not null default 'pending',  -- pending, regret, reserved, submitted
  offer_at timestamptz,
  ref text,                                       -- where they came from (referrer)
  first_vid text,                                 -- anonymous visitor id before signup
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index if not exists profiles_created_idx on public.profiles (created_at desc);

-- Accounts that existed before v1.1 (signed up from report.html)
insert into public.profiles (id, email, name, phone, created_at)
select u.id, lower(u.email), u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'whatsapp', u.created_at
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- "Reserve my slot" answers.
create table if not exists public.slot_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  name text,
  phone text not null,
  platforms text[] not null default '{}',         -- etsy, shopify, ebay
  target_sales int,                               -- 10, 100, 1000 per month
  wait_months int,                                -- 1, 2, 3, 6
  links jsonb not null default '{}'::jsonb,       -- {"etsy": "https://..."}
  has_pinterest boolean,
  pinterest_url text,
  created_at timestamptz not null default now()
);
create index if not exists slot_res_user_idx on public.slot_reservations (user_id, created_at desc);

-- Page views for the admin panel (no IP, no cookies).
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  vid text not null,           -- anonymous visitor id (browser)
  sid text not null,           -- visit / session id (30 min)
  kind text not null default 'view',   -- view or engage
  path text not null,
  ref text,
  country text,
  device text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists page_views_time_idx on public.page_views (created_at desc);
create index if not exists page_views_sid_idx on public.page_views (sid);

-- Who may open /admin. Add rows here (Table Editor or SQL). SUPER_ADMIN_EMAIL in Vercel is always admin.
create table if not exists public.admin_emails (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);

-- Phones / browsers that allowed notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_user_idx on public.push_subscriptions (user_id);

-- Messages you send from the admin panel. One row per person.
create table if not exists public.user_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text,
  image_url text,
  sent_by text,
  push_ok int not null default 0,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists user_msg_user_idx on public.user_messages (user_id, seen_at, created_at desc);

-- Lock everything: only the server (service key) can read or write.
alter table public.profiles enable row level security;
alter table public.slot_reservations enable row level security;
alter table public.page_views enable row level security;
alter table public.admin_emails enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.user_messages enable row level security;

-- Public bucket for images you send in messages.
insert into storage.buckets (id, name, public)
values ('gmp-messages', 'gmp-messages', true)
on conflict (id) do nothing;

-- Dashboard numbers in one call. Times grouped by India time.
create or replace function public.gmp_admin_stats(days int)
returns jsonb
language sql
stable
set search_path = public
as $fn$
with pv as (
  select * from public.page_views
  where created_at >= now() - make_interval(days => greatest(days, 1))
),
views as (select * from pv where kind = 'view'),
sess as (
  select sid,
         count(*) filter (where kind = 'view') as n_views,
         count(*) filter (where kind = 'engage') as n_engage,
         max(created_at) - min(created_at) as span
  from pv group by sid
),
prof as (
  select * from public.profiles
  where created_at >= now() - make_interval(days => greatest(days, 1))
)
select jsonb_build_object(
  'pageviews', (select count(*) from views),
  'visitors', (select count(distinct vid) from views),
  'sessions', (select count(*) from sess where n_views > 0),
  'bounced', (select count(*) from sess where n_views = 1 and n_engage = 0),
  'avg_session_sec', (select coalesce(round(avg(extract(epoch from span))), 0) from sess where n_views > 0),
  'signups', (select count(*) from prof),
  'signups_total', (select count(*) from public.profiles),
  'offer', (select coalesce(jsonb_object_agg(offer_status, n), '{}'::jsonb)
            from (select offer_status, count(*) n from prof group by 1) x),
  'reservations', (select count(*) from public.slot_reservations
                   where created_at >= now() - make_interval(days => greatest(days, 1))),
  'push_devices', (select count(*) from public.push_subscriptions),
  'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visitors', v, 'views', n, 'signups', s) order by d), '[]'::jsonb)
            from (
              select coalesce(a.d, b.d) d, coalesce(a.v, 0) v, coalesce(a.n, 0) n, coalesce(b.s, 0) s
              from (select (created_at at time zone 'Asia/Kolkata')::date d, count(distinct vid) v, count(*) n from views group by 1) a
              full join (select (created_at at time zone 'Asia/Kolkata')::date d, count(*) s from prof group by 1) b on a.d = b.d
            ) t),
  'pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', n, 'visitors', v) order by n desc), '[]'::jsonb)
            from (select path, count(*) n, count(distinct vid) v from views group by path order by n desc limit 12) x),
  'refs', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'visits', n) order by n desc), '[]'::jsonb)
           from (select coalesce(ref, 'Direct / none') ref, count(distinct sid) n from views group by 1 order by n desc limit 10) x),
  'devices', (select coalesce(jsonb_object_agg(device, n), '{}'::jsonb)
              from (select coalesce(device, 'unknown') device, count(distinct vid) n from views group by 1) x),
  'countries', (select coalesce(jsonb_agg(jsonb_build_object('country', country, 'visitors', n) order by n desc), '[]'::jsonb)
                from (select coalesce(country, '??') country, count(distinct vid) n from views group by 1 order by n desc limit 10) x)
);
$fn$;

-- Only the server may call it (not the public anon key).
revoke all on function public.gmp_admin_stats(int) from public, anon, authenticated;
grant execute on function public.gmp_admin_stats(int) to service_role;

-- Optional clean-up: keep 13 months of page views.
-- delete from public.page_views where created_at < now() - interval '13 months';

-- ADD YOURSELF / YOUR TEAM AS ADMIN (lowercase email). Example:
-- insert into public.admin_emails (email, note) values ('teammate@example.com', 'team');

-- =====================================================================
-- v1.2  Settings you change from the admin panel, personal home page,
--       "I want more store visits" leads. Safe to run again.
-- =====================================================================

-- Shop details on the profile (filled by the slot form or the home page).
alter table public.profiles add column if not exists platforms text[] not null default '{}';
alter table public.profiles add column if not exists shop_links jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists pinterest_url text;
alter table public.profiles add column if not exists target_sales int;
alter table public.profiles add column if not exists wait_months int;
alter table public.profiles add column if not exists interest_at timestamptz;      -- clicked "I want to increase visits"
alter table public.profiles add column if not exists interest_count int not null default 0;
alter table public.profiles add column if not exists interest_source text;

-- Copy shop details from the newest slot form (for people who filled it before v1.2).
update public.profiles p
set platforms = r.platforms, shop_links = r.links, pinterest_url = r.pinterest_url,
    target_sales = r.target_sales, wait_months = r.wait_months
from (
  select distinct on (user_id) * from public.slot_reservations order by user_id, created_at desc
) r
where r.user_id = p.id and coalesce(array_length(p.platforms, 1), 0) = 0;

-- All texts, dates and switches you edit in Admin > Settings. One row only.
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.site_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
alter table public.site_settings enable row level security;

-- Dashboard numbers (v1.2 adds "interested").
create or replace function public.gmp_admin_stats(days int)
returns jsonb
language sql
stable
set search_path = public
as $fn$
with pv as (
  select * from public.page_views
  where created_at >= now() - make_interval(days => greatest(days, 1))
),
views as (select * from pv where kind = 'view'),
sess as (
  select sid,
         count(*) filter (where kind = 'view') as n_views,
         count(*) filter (where kind = 'engage') as n_engage,
         max(created_at) - min(created_at) as span
  from pv group by sid
),
prof as (
  select * from public.profiles
  where created_at >= now() - make_interval(days => greatest(days, 1))
)
select jsonb_build_object(
  'pageviews', (select count(*) from views),
  'visitors', (select count(distinct vid) from views),
  'sessions', (select count(*) from sess where n_views > 0),
  'bounced', (select count(*) from sess where n_views = 1 and n_engage = 0),
  'avg_session_sec', (select coalesce(round(avg(extract(epoch from span))), 0) from sess where n_views > 0),
  'signups', (select count(*) from prof),
  'signups_total', (select count(*) from public.profiles),
  'offer', (select coalesce(jsonb_object_agg(offer_status, n), '{}'::jsonb)
            from (select offer_status, count(*) n from prof group by 1) x),
  'reservations', (select count(*) from public.slot_reservations
                   where created_at >= now() - make_interval(days => greatest(days, 1))),
  'interested', (select count(*) from public.profiles
                 where interest_at >= now() - make_interval(days => greatest(days, 1))),
  'push_devices', (select count(*) from public.push_subscriptions),
  'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visitors', v, 'views', n, 'signups', s) order by d), '[]'::jsonb)
            from (
              select coalesce(a.d, b.d) d, coalesce(a.v, 0) v, coalesce(a.n, 0) n, coalesce(b.s, 0) s
              from (select (created_at at time zone 'Asia/Kolkata')::date d, count(distinct vid) v, count(*) n from views group by 1) a
              full join (select (created_at at time zone 'Asia/Kolkata')::date d, count(*) s from prof group by 1) b on a.d = b.d
            ) t),
  'pages', (select coalesce(jsonb_agg(jsonb_build_object('path', path, 'views', n, 'visitors', v) order by n desc), '[]'::jsonb)
            from (select path, count(*) n, count(distinct vid) v from views group by path order by n desc limit 12) x),
  'refs', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'visits', n) order by n desc), '[]'::jsonb)
           from (select coalesce(ref, 'Direct / none') ref, count(distinct sid) n from views group by 1 order by n desc limit 10) x),
  'devices', (select coalesce(jsonb_object_agg(device, n), '{}'::jsonb)
              from (select coalesce(device, 'unknown') device, count(distinct vid) n from views group by 1) x),
  'countries', (select coalesce(jsonb_agg(jsonb_build_object('country', country, 'visitors', n) order by n desc), '[]'::jsonb)
                from (select coalesce(country, '??') country, count(distinct vid) n from views group by 1 order by n desc limit 10) x)
);
$fn$;
revoke all on function public.gmp_admin_stats(int) from public, anon, authenticated;
grant execute on function public.gmp_admin_stats(int) to service_role;


-- OPTIONAL: run the background job every 10 minutes from Supabase itself.
-- Replace YOUR-SITE and YOUR_CRON_SECRET first, then run these lines.
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
-- select cron.schedule(
--   'gmp-report-cron',
--   '*/10 * * * *',
--   $$ select net.http_get(url := 'https://YOUR-SITE/api/report/cron?key=YOUR_CRON_SECRET') $$
-- );
