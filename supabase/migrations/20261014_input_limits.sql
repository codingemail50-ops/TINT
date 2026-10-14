-- Size and format limits on what a signed-in user can write.
-- Idempotent -- safe to re-run. Run in the Supabase SQL Editor (choose
-- "Run without RLS" if it asks; this file creates no tables).
--
-- Why: the app limits what you can type, but anyone with an account can call
-- the database directly, where nothing limited text length, list sizes, or how
-- many rows one person could create. These limits are deliberately LOOSER than
-- the app's own, so normal use never hits them.
--
-- Run this AFTER 20261009_*.sql and 20261014_friend_requests_lockdown.sql.
-- Do not re-run the older challenge files over it: they recreate the functions
-- below without the limits.
--
-- Check first (optional): rows that already break a limit. The constraints are
-- added NOT VALID, so existing rows never block this file, but an UPDATE to a
-- row that breaks a limit would be refused until that row is fixed.
--   select id, char_length(name) from public.user_data where char_length(name) > 40;

-- ── helpers used by the constraints ──────────────────────────────────────

create or replace function public.text_array_within(a text[], max_items int, max_len int)
returns boolean
language sql
immutable
set search_path = public
as $$
  select a is null
     or (cardinality(a) <= max_items
         and not exists (select 1 from unnest(a) x where char_length(x) > max_len));
$$;

create or replace function public.json_within(j jsonb, max_chars int)
returns boolean
language sql
immutable
set search_path = public
as $$
  select j is null or length(j::text) <= max_chars;
$$;

revoke all on function public.text_array_within(text[], int, int) from public, anon;
revoke all on function public.json_within(jsonb, int) from public, anon;
grant execute on function public.text_array_within(text[], int, int) to authenticated;
grant execute on function public.json_within(jsonb, int) to authenticated;

-- ── profile rows ─────────────────────────────────────────────────────────

alter table public.user_data drop constraint if exists user_data_limits;
alter table public.user_data add constraint user_data_limits check (
      char_length(name) <= 40
  and char_length(avatar) <= 40
  and char_length(email) <= 254
  and char_length(future_goal_text) <= 120
  and char_length(future_goal_date) <= 40
  and char_length(class_twelve_stream) <= 40
  and char_length(last_active_date) <= 40
  and char_length(today_tasks_date) <= 40
  and public.text_array_within(exams, 20, 60)
  and public.json_within(history, 5000000)
  and public.json_within(focus_log, 2000000)
  and public.json_within(today_tasks, 1000000)
) not valid;

-- ── 7 Day Lock In functions ──────────────────────────────────────────────
-- Same as before, plus limits. Ownership, search_path and grants are unchanged.

create or replace function public.create_challenge(
  p_mode text,
  p_apps text[],
  p_start_at timestamptz default null
)
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_code text;
  v_name text;
  v_avatar text;
  tries int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_mode not in ('solo', 'squad') then raise exception 'bad mode'; end if;
  if not public.text_array_within(p_apps, 30, 100) then raise exception 'too many or too long app names'; end if;
  if public._in_open_challenge(uid) then raise exception 'already in a challenge'; end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.challenges where code = v_code);
    tries := tries + 1;
    if tries > 20 then raise exception 'could not make a code, try again'; end if;
  end loop;

  v_name := (select u.name from public.user_data u where u.id = uid);
  v_avatar := (select u.avatar from public.user_data u where u.id = uid);

  insert into public.challenges (id, code, creator_id, mode, status, start_at)
  values (
    v_id, v_code, uid, p_mode,
    case when p_mode = 'solo' then 'active' else 'lobby' end,
    case when p_mode = 'solo' then coalesce(p_start_at, now()) else null end
  );

  insert into public.challenge_members (challenge_id, user_id, name, avatar, apps)
  values (v_id, uid, coalesce(v_name, 'Anonymous'), coalesce(v_avatar, 'star'), coalesce(p_apps, '{}'));

  return (select c from public.challenges c where c.id = v_id);
end;
$$;

create or replace function public.join_challenge(p_code text, p_apps text[])
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_avatar text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if not public.text_array_within(p_apps, 30, 100) then raise exception 'too many or too long app names'; end if;
  if public._in_open_challenge(uid) then raise exception 'already in a challenge'; end if;

  v_id := (select c.id from public.challenges c
           where c.code = upper(trim(p_code)) and c.mode = 'squad' and c.status = 'lobby');
  if v_id is null then raise exception 'code not found, or that squad already started'; end if;

  if (select count(*) from public.challenge_members m where m.challenge_id = v_id) >= 6 then
    raise exception 'this squad is full (6 max)';
  end if;

  v_name := (select u.name from public.user_data u where u.id = uid);
  v_avatar := (select u.avatar from public.user_data u where u.id = uid);

  insert into public.challenge_members (challenge_id, user_id, name, avatar, apps)
  values (v_id, uid, coalesce(v_name, 'Anonymous'), coalesce(v_avatar, 'star'), coalesce(p_apps, '{}'));

  return (select c from public.challenges c where c.id = v_id);
end;
$$;

-- The phone's own before-snapshot / final report / emergency count. Data over
-- the limits is ignored (nothing is saved), like a call from a non-member.
create or replace function public.save_challenge_member_data(
  p_id uuid,
  p_baseline jsonb default null,
  p_report jsonb default null,
  p_emergency_used int default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.challenge_member_private as t (challenge_id, user_id, baseline, report, emergency_used)
  select p_id, auth.uid(), p_baseline, p_report, coalesce(p_emergency_used, 0)
  where public.is_challenge_member(p_id)
    and public.json_within(p_baseline, 100000)
    and public.json_within(p_report, 100000)
    and (p_emergency_used is null or p_emergency_used between 0 and 100)
  on conflict (challenge_id, user_id) do update
  set baseline = coalesce(t.baseline, excluded.baseline),
      report = coalesce(excluded.report, t.report),
      emergency_used = case when p_emergency_used is null then t.emergency_used else excluded.emergency_used end;
$$;

-- One row per person per day. The day must look like yyyymmdd, the per-app
-- counts must be small, and one person gets at most 14 day rows per challenge
-- (a challenge is 7 days; the spare covers time-zone edges).
create or replace function public.upload_day_stats(
  p_id uuid,
  p_day text,
  p_opens int,
  p_per_app jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_challenge_member(p_id) then return; end if;
  if p_day is null or p_day !~ '^[0-9]{8}$' then raise exception 'bad day'; end if;
  if not public.json_within(p_per_app, 8000) then raise exception 'too much data'; end if;
  if not exists (
       select 1 from public.challenge_day_stats
       where challenge_id = p_id and user_id = auth.uid() and day = p_day)
     and (select count(*) from public.challenge_day_stats
          where challenge_id = p_id and user_id = auth.uid()) >= 14
  then
    return;
  end if;
  insert into public.challenge_day_stats (challenge_id, user_id, day, opens, per_app)
  values (p_id, auth.uid(), p_day, least(greatest(coalesce(p_opens, 0), 0), 1000000), coalesce(p_per_app, '{}'::jsonb))
  on conflict (challenge_id, user_id, day)
  do update set opens = excluded.opens, per_app = excluded.per_app;
end;
$$;
