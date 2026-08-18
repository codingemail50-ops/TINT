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
  created_at timestamptz default now()
);

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
