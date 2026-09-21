-- ─────────────────────────────────────────────────────────────────────────
-- Leaderboard: compute today/week/all-time live from focus_log
-- ─────────────────────────────────────────────────────────────────────────
-- Standalone and idempotent. Run this whole file, top to bottom, in the
-- Supabase SQL editor. It is the leaderboard half of schema.sql pulled out
-- on its own so it can be applied to a live database without re-running the
-- table definitions, RLS policies and one-time repair blocks around it.
--
-- Everything here is safe to run more than once, and it touches no table
-- data — only the function and the three objects that read it.
--
-- Run it as a SINGLE statement batch. The view and the two functions below
-- all call focus_stats_from_log, so creating it first in the same run is
-- the whole point: running any of them on their own is what produces
--   ERROR: function public.focus_stats_from_log(jsonb) does not exist
--
-- Why this exists: focus_today_mins / focus_week_mins / focus_alltime_mins
-- are stored columns, refreshed only when that specific person's own device
-- syncs. Anyone who stops opening the app keeps showing whatever totals
-- their last sync computed, forever, on everyone else's leaderboard —
-- "today" in particular never reset at midnight, which is what looked like
-- residue piling up. These read the raw log instead.

-- ── 1. the function everything else depends on ──────────────────────────
-- "Today"/"week" are necessarily approximate across timezones: each entry's
-- `date` was written as that device's own local calendar day (JS's
-- Date.toDateString(), e.g. "Thu Sep 09 2026"), while current_date here is
-- the database's (UTC on Supabase). Entries logged within a few hours of
-- midnight can land a day off. Still far better than staying wrong for days.
--
-- Defensive throughout: a malformed `mins` contributes 0, and `date` is only
-- handed to to_date() once validated as exactly a "Www Mon DD YYYY" shape
-- with a real weekday and month. to_date() throwing on one garbled row would
-- break this function, and so the leaderboard, for everyone. A date failing
-- any check is excluded from today/week, but its mins still count toward
-- all-time, which needs no date parsing at all.
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

-- ── 2. leaderboard_view ─────────────────────────────────────────────────
-- Dropped rather than replaced: `create or replace view` cannot change a
-- view's column list, order or types, so replacing an older deployed view
-- whose shape differs fails with a second, more confusing error.
--
-- Plain view with NO `security_invoker`, so it runs as its owner (postgres
-- on Supabase, which has BYPASSRLS) rather than as the querying client.
-- That's what lets it read every row despite user_data's owner-only RLS.
-- The column list is the entire privacy boundary — never add email,
-- today_tasks or focus_log itself to it. The live-computed sums are fine to
-- expose; the raw log with individual session timestamps is not.
drop view if exists public.leaderboard_view;

create view public.leaderboard_view as
select u.id, u.name, u.avatar, u.exams, u.streak, u.history, u.total_tasks_completed,
       fs.today_mins as focus_today_mins,
       fs.week_mins as focus_week_mins,
       fs.alltime_mins as focus_alltime_mins
from public.user_data u
cross join lateral public.focus_stats_from_log(u.focus_log) fs;

grant select on public.leaderboard_view to authenticated;

-- ── 3. friends_leaderboard ──────────────────────────────────────────────
-- Dropped first for the same reason as the view: Postgres refuses to
-- replace a function whose return type changed, and the three focus columns
-- moved to double precision.
--
-- security definer so it can read past user_data's RLS; it still enforces
-- "only rows for auth.uid()" since callers cannot pass an arbitrary user_id
-- into it — it is a function of auth.uid() alone.
drop function if exists public.friends_leaderboard();

create function public.friends_leaderboard()
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

-- ── 4. find_user_by_email ───────────────────────────────────────────────
-- Exact-match, case-insensitive lookup for "add a friend" — display names
-- aren't unique, so email is the only reliable way to find one person.
-- security definer so it can read the email column despite owner-only RLS;
-- the returned columns are the same public-safe set as above, so the caller
-- never gets anyone's email back, including the one they searched on a hit.
drop function if exists public.find_user_by_email(text);

create function public.find_user_by_email(p_email text)
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

-- ── 5. check it worked ──────────────────────────────────────────────────
-- Should return one row per user with live today/week/all-time totals.
-- If "today" is 0 for everyone and nobody has focused since UTC midnight,
-- that is correct, not a failure.
select name, focus_today_mins, focus_week_mins, focus_alltime_mins
from public.leaderboard_view
order by focus_alltime_mins desc
limit 10;
