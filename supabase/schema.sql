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
  created_at timestamptz default now()
);

-- Re-running this file after the column already existed in an older version
-- of this schema won't error — ALTER ... ADD COLUMN IF NOT EXISTS is a no-op
-- when the column is already there.
alter table public.user_data add column if not exists daily_focus_goal_mins int not null default 60;

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

-- ── leaderboard_view ─────────────────────────────────────────────────────
-- Public read-only view exposing ONLY the non-sensitive columns needed for
-- the leaderboard — never email, today_tasks, or focus_log.
--
-- This is a plain view with NO `security_invoker`, so it runs as its owner
-- (the role that executes this script — `postgres` on Supabase, which has
-- BYPASSRLS) rather than as the querying client. That's what lets it read
-- every row for the leaderboard despite user_data's RLS restricting the
-- base table to owner-only access. The view's column list is the entire
-- privacy boundary here — never add email/today_tasks/focus_log to it.
create or replace view public.leaderboard_view as
select id, name, avatar, exams, streak, history, total_tasks_completed
from public.user_data;

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
returns table (id uuid, name text, avatar text, exams text[], streak int, history jsonb, total_tasks_completed int)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.avatar, u.exams, u.streak, u.history, u.total_tasks_completed
  from public.user_data u
  join public.friendships f on f.friend_id = u.id
  where f.user_id = auth.uid();
$$;

grant execute on function public.friends_leaderboard() to authenticated;
