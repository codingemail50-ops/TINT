-- TINT database schema + Row Level Security.
-- Idempotent: safe to run multiple times against the same project.
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).

-- ── user_data ─────────────────────────────────────────────────────────────
-- One row per auth user (anonymous or real). id matches auth.users.id.
-- Holds private fields (email, today_tasks, focus_log) alongside the public
-- leaderboard fields — access to the FULL row is restricted to the owning
-- user only; public leaderboard reads go through leaderboard_view below,
-- which exposes just the safe columns.
create table if not exists public.user_data (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  avatar text,
  exams text[] default '{}',
  streak int default 0,
  longest_streak int default 0,
  last_active_date text,
  total_tasks_completed int default 0,
  history jsonb default '[]'::jsonb,
  today_tasks jsonb,
  today_tasks_date text,
  focus_log jsonb default '[]'::jsonb,
  daily_focus_goal_mins int not null default 60,
  -- Pre-aggregated focus-time rollups, recomputed client-side from
  -- focus_log and pushed alongside it (see supabaseStorage.ts's
  -- syncFocusLog). Kept separate from focus_log itself because these three
  -- numbers are safe to expose on the public leaderboard — the raw log
  -- (individual session timestamps) isn't. double precision (not int) so a
  -- session that ends early keeps its exact fractional-minute value instead
  -- of being rounded away — that precision is what lets the leaderboard
  -- rank ties down to the second instead of the whole minute.
  focus_today_mins double precision not null default 0,
  focus_week_mins double precision not null default 0,
  focus_alltime_mins double precision not null default 0,
  -- Set on the walkthrough's final screen — the one thing they're actually
  -- using TINT to get to. Private (not on leaderboard_view), same as email.
  future_goal_text text,
  future_goal_date text,
  -- Only meaningful when 'CLASS12' is in exams — which stream's boards
  -- they're prepping for. Private, same reasoning as the goal fields above.
  class_twelve_stream text,
  created_at timestamptz default now()
);

-- Re-running this file after the column already existed in an older version
-- of this schema won't error — ALTER ... ADD COLUMN IF NOT EXISTS is a no-op
-- when the column is already there.
alter table public.user_data add column if not exists daily_focus_goal_mins int not null default 60;
alter table public.user_data add column if not exists focus_today_mins double precision not null default 0;
alter table public.user_data add column if not exists focus_week_mins double precision not null default 0;
alter table public.user_data add column if not exists focus_alltime_mins double precision not null default 0;
alter table public.user_data add column if not exists future_goal_text text;
alter table public.user_data add column if not exists future_goal_date text;
alter table public.user_data add column if not exists class_twelve_stream text;
-- In case this file was previously run with the old `int` column type —
-- widen in place so existing rows keep their data instead of needing a drop.
-- Guarded on the column's current type: once leaderboard_view exists (i.e.
-- after this file has run once), Postgres refuses ALTER COLUMN TYPE on a
-- column a view depends on even when the type isn't actually changing, so
-- this must be skipped entirely on every re-run, not just made idempotent.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'user_data' and column_name = 'focus_today_mins') <> 'double precision' then
    alter table public.user_data alter column focus_today_mins type double precision;
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'user_data' and column_name = 'focus_week_mins') <> 'double precision' then
    alter table public.user_data alter column focus_week_mins type double precision;
  end if;
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'user_data' and column_name = 'focus_alltime_mins') <> 'double precision' then
    alter table public.user_data alter column focus_alltime_mins type double precision;
  end if;
end $$;

alter table public.user_data enable row level security;

-- Policies are dropped and recreated so this file can be re-run safely
-- after edits, instead of erroring on "already exists". Only three
-- policies total, all scoped to auth.uid() = id — nobody can read or write
-- another user's row through this table, full stop. Public leaderboard
-- access is handled entirely by the view below, not by a table policy.
drop policy if exists "user can read own row" on public.user_data;
create policy "user can read own row"
  on public.user_data for select
  using (auth.uid() = id);

drop policy if exists "user can insert own row" on public.user_data;
create policy "user can insert own row"
  on public.user_data for insert
  with check (auth.uid() = id);

drop policy if exists "user can update own row" on public.user_data;
create policy "user can update own row"
  on public.user_data for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No delete policy: users can't delete their own row from the client.
-- (Add one deliberately later if you want a "delete my account" feature.)

-- ── focus_stats_from_log ─────────────────────────────────────────────────
-- Computes today/week/all-time focus minutes live from a user's raw
-- focus_log, instead of trusting the stored focus_today_mins/
-- focus_week_mins/focus_alltime_mins columns. Those are only refreshed
-- when that specific person's own device happens to sync (see
-- syncFocusLog in supabaseStorage.ts) — so anyone who stops opening the
-- app keeps showing whatever "today"/"week" total their last sync
-- happened to compute, indefinitely, on everyone else's leaderboard.
-- "Today" in particular never reset at midnight this way, which is what
-- looked like leftover residue piling up. Computing live from focus_log
-- fixes that (and the equivalent staleness in "week" and "all-time") at
-- the cost of a bit of query-time work per row.
--
-- "Today"/"week" are necessarily approximate across timezones: each
-- entry's `date` was written as that device's own local calendar day
-- (JS's Date.toDateString(), e.g. "Thu Sep 09 2026"), but this function's
-- notion of "today" is the database's own current_date (UTC on Supabase).
-- For someone whose local timezone is well offset from UTC, entries
-- logged within a few hours of midnight can land a day off from what
-- their own device would call "today." That's still far more correct
-- than staying wrong for days at a time, and is the same tradeoff most
-- apps without per-user timezone tracking make.
--
-- Defensive per the repair block further down, and then some: a malformed
-- `mins` (not a JSON number) contributes 0. `date` is only ever handed to
-- to_date() once it's been validated as EXACTLY a "Www Mon DD YYYY" shape
-- (regex) with a real weekday and a real month abbreviation (explicit
-- membership checks below) — to_date() throwing on one garbled row would
-- break this function, and therefore the whole leaderboard, for everyone,
-- the same failure mode the repair block's own comment describes. A `date`
-- that doesn't pass all three checks is excluded from today/week, but its
-- mins still count toward all-time, which needs no date parsing at all.
create or replace function public.focus_stats_from_log(p_log jsonb)
returns table (today_mins double precision, week_mins double precision, alltime_mins double precision)
language sql
stable
as $$
  with entries as (
    select
      case when jsonb_typeof(e->'mins') = 'number' then (e->>'mins')::double precision else 0 end as mins,
      case
        when (e->>'date') ~ '^[A-Za-z]{3} [A-Za-z]{3} \d{2} \d{4}$'
          and upper(substring(e->>'date' from 1 for 3)) in ('SUN','MON','TUE','WED','THU','FRI','SAT')
          and upper(substring(e->>'date' from 5 for 3)) in
            ('JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC')
        then to_date(e->>'date', 'Dy Mon DD YYYY')
        else null
      end as parsed_date
    from jsonb_array_elements(case when jsonb_typeof(p_log) = 'array' then p_log else '[]'::jsonb end) e
  )
  select
    coalesce(sum(case when parsed_date = current_date then mins else 0 end), 0) as today_mins,
    coalesce(sum(case when parsed_date >= current_date - 6 then mins else 0 end), 0) as week_mins,
    coalesce(sum(mins), 0) as alltime_mins
  from entries;
$$;

grant execute on function public.focus_stats_from_log(jsonb) to authenticated;

-- ── leaderboard_view ─────────────────────────────────────────────────────
-- Public read-only view exposing ONLY the non-sensitive columns needed for
-- the leaderboard — never email, today_tasks, or focus_log itself (the
-- live-computed sums below are fine to expose; the raw log with individual
-- session timestamps is not).
--
-- This is a plain view with NO `security_invoker`, so it runs as its owner
-- (the role that executes this script — `postgres` on Supabase, which has
-- BYPASSRLS) rather than as the querying client. That's what lets it read
-- every row for the leaderboard despite user_data's RLS restricting the
-- base table to owner-only access. The view's column list is the entire
-- privacy boundary here — never add email/today_tasks/focus_log to it.
create or replace view public.leaderboard_view as
select u.id, u.name, u.avatar, u.exams, u.streak, u.history, u.total_tasks_completed,
       fs.today_mins as focus_today_mins,
       fs.week_mins as focus_week_mins,
       fs.alltime_mins as focus_alltime_mins
from public.user_data u
cross join lateral public.focus_stats_from_log(u.focus_log) fs;

grant select on public.leaderboard_view to authenticated;

-- ── friend_requests ──────────────────────────────────────────────────────
-- One row per request, from_user -> to_user. An accepted row IS the
-- friendship (no separate friendships table to keep in sync) — see the
-- friendships view below, which reads both directions of accepted rows.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  responded_at timestamptz,
  constraint no_self_request check (from_user <> to_user),
  unique (from_user, to_user)
);

alter table public.friend_requests enable row level security;

-- Either side of a request can see it; only the sender can create one;
-- either side can update it (accept/decline the incoming one, or cancel
-- one you sent) -- the app is responsible for only offering the buttons
-- that make sense for which side of the row the current user is on, RLS
-- here just guards against touching a request that isn't yours at all.
drop policy if exists "see requests you're part of" on public.friend_requests;
create policy "see requests you're part of"
  on public.friend_requests for select
  using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "send requests as yourself" on public.friend_requests;
create policy "send requests as yourself"
  on public.friend_requests for insert
  with check (auth.uid() = from_user);

drop policy if exists "respond to requests you're part of" on public.friend_requests;
create policy "respond to requests you're part of"
  on public.friend_requests for update
  using (auth.uid() = from_user or auth.uid() = to_user)
  with check (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "cancel requests you're part of" on public.friend_requests;
create policy "cancel requests you're part of"
  on public.friend_requests for delete
  using (auth.uid() = from_user or auth.uid() = to_user);

-- ── friendships ───────────────────────────────────────────────────────────
-- Symmetric view over accepted requests: querying `where user_id =
-- auth.uid()` gets your friends regardless of who originally sent the
-- request. security_invoker=true (unlike leaderboard_view) so this stays
-- subject to the caller's own RLS on friend_requests -- you can only ever
-- see rows you were already allowed to see there.
create or replace view public.friendships
with (security_invoker = true) as
select from_user as user_id, to_user as friend_id, created_at
from public.friend_requests where status = 'accepted'
union all
select to_user as user_id, from_user as friend_id, created_at
from public.friend_requests where status = 'accepted';

grant select on public.friendships to authenticated;

-- ── friends_leaderboard_view ─────────────────────────────────────────────
-- Public-safe columns (same boundary as leaderboard_view) joined against
-- friendships, so the app can query "just my friends" instead of
-- everyone. No security_invoker: needs owner privileges to read across
-- user_data like leaderboard_view does, but friendships itself (joined in)
-- still enforces "only rows for auth.uid()" since callers can't pass an
-- arbitrary user_id into a view -- this view is a function of auth.uid()
-- alone, called with `select * from friends_leaderboard_view()`.
create or replace function public.friends_leaderboard()
returns table (
  id uuid, name text, avatar text, exams text[], streak int, history jsonb, total_tasks_completed int,
  focus_today_mins double precision, focus_week_mins double precision, focus_alltime_mins double precision
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.avatar, u.exams, u.streak, u.history, u.total_tasks_completed,
         fs.today_mins, fs.week_mins, fs.alltime_mins
  from public.user_data u
  join public.friendships f on f.friend_id = u.id
  cross join lateral public.focus_stats_from_log(u.focus_log) fs
  where f.user_id = auth.uid();
$$;

grant execute on function public.friends_leaderboard() to authenticated;

-- ── find_user_by_email ───────────────────────────────────────────────────
-- Exact-match, case-insensitive lookup by email for "add a friend" --
-- display names aren't unique, so email is the only reliable way to find
-- one specific person. security definer so it can read the email column
-- despite user_data's owner-only RLS; the returned columns are the same
-- public-safe set leaderboard_view already exposes -- the caller never
-- gets anyone's email back, including the one they searched on a hit.
create or replace function public.find_user_by_email(p_email text)
returns table (
  id uuid, name text, avatar text, exams text[], streak int, history jsonb, total_tasks_completed int,
  focus_today_mins double precision, focus_week_mins double precision, focus_alltime_mins double precision
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.avatar, u.exams, u.streak, u.history, u.total_tasks_completed,
         fs.today_mins, fs.week_mins, fs.alltime_mins
  from public.user_data u
  cross join lateral public.focus_stats_from_log(u.focus_log) fs
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

grant execute on function public.find_user_by_email(text) to authenticated;

-- ── One-time repair: duplicate focus_log entries ────────────────────────
-- A task-linked focus session naturally completing used to log its minutes
-- twice (once in FocusScreen's own completion handler, once again right
-- after in Today's screen -- since fixed in the app) leaving two back-to-
-- back entries in focus_log with the same date and the same duration,
-- logged within a few seconds of each other. That inflated every affected
-- person's leaderboard time (e.g. a real 3-hour session showing as more
-- like 6) permanently, since focus_alltime_mins never ages out. The app
-- now also self-heals this on-device the next time it's opened, but that
-- only fixes what's stored locally + whatever that person syncs next --
-- this repairs every row's stored focus_log (and focus_alltime_mins) in
-- one pass so the leaderboard is correct immediately for everyone,
-- including people who don't reopen the app right away. Safe to re-run --
-- once the duplicates are gone there's nothing left to remove.
--
-- Defensive on purpose: a real-world focus_log can have rows that aren't a
-- clean jsonb array, or entries with a non-numeric mins / malformed
-- timestamp, from older bugs or manual edits over this app's history. An
-- earlier version of this block cast those fields directly and let a
-- single bad row throw and abort the whole statement -- which, worse,
-- rolled back every OTHER statement run in the same paste alongside it
-- (including plain column additions elsewhere in this file that have
-- nothing to do with focus_log). Every cast below is guarded with a
-- jsonb_typeof/regexp check first so a malformed entry is just skipped
-- (treated as 0 / no timestamp) instead of failing the migration.
with expanded as (
  select
    u.id,
    t.elem,
    t.ordinality,
    case when jsonb_typeof(t.elem->'mins') = 'number'
      then (t.elem->>'mins')::double precision
      else null
    end as mins,
    t.elem->>'date' as date,
    case when (t.elem->>'timestamp') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
      then (t.elem->>'timestamp')::timestamptz
      else null
    end as ts
  from public.user_data u,
    jsonb_array_elements(u.focus_log) with ordinality as t(elem, ordinality)
  where jsonb_typeof(u.focus_log) = 'array'
),
flagged as (
  select *,
    lag(mins) over (partition by id order by ordinality) as prev_mins,
    lag(date) over (partition by id order by ordinality) as prev_date,
    lag(ts) over (partition by id order by ordinality) as prev_ts
  from expanded
),
deduped as (
  select id, elem, ordinality
  from flagged
  where not (
    prev_mins is not null and mins is not null
    and date = prev_date
    and abs(mins - prev_mins) < 0.01
    and ts is not null and prev_ts is not null
    and abs(extract(epoch from (ts - prev_ts))) < 5
  )
),
rebuilt as (
  select id, jsonb_agg(elem order by ordinality) as new_log
  from deduped
  group by id
)
update public.user_data u
set focus_log = r.new_log,
    focus_alltime_mins = (
      select coalesce(sum(
        case when jsonb_typeof(e->'mins') = 'number' then (e->>'mins')::double precision else 0 end
      ), 0)
      from jsonb_array_elements(r.new_log) e
    )
from rebuilt r
where u.id = r.id
  and r.new_log is distinct from u.focus_log;
