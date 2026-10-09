-- 7 Day Lock In challenge: solo + squad (up to 6). Idempotent -- safe to
-- re-run. Run in the Supabase SQL Editor (Dashboard to SQL Editor to New query).
--
-- All writes go through the functions at the bottom (security definer), so a
-- client cant invent codes, join full/started squads, or edit other
-- peoples rows. Tables only allow members to READ their own challenge.

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  creator_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('solo', 'squad')),
  -- lobby = squad still gathering; active = started (solo starts at once,
  -- or at a chosen future time). It is over once start_at + days has passed.
  status text not null default 'lobby' check (status in ('lobby', 'active')),
  days int not null default 7,
  start_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Anonymous',
  avatar text not null default 'star',
  apps text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'quit')),
  joined_at timestamptz not null default now(),
  quit_at timestamptz,
  last_seen_at timestamptz,
  emergency_used int not null default 0,
  baseline jsonb,
  report jsonb,
  primary key (challenge_id, user_id)
);

-- One row per person per day: how many times they tried to open a blocked app.
create table if not exists public.challenge_day_stats (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day text not null, -- yyyyMMdd, the phone's local day
  opens int not null default 0,
  per_app jsonb not null default '{}'::jsonb,
  primary key (challenge_id, user_id, day)
);

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_day_stats enable row level security;

-- security definer so the policies below dont recurse into themselves.
create or replace function public.is_challenge_member(cid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.challenge_members
    where challenge_id = cid and user_id = auth.uid()
  );
$$;

drop policy if exists "members read their challenge" on public.challenges;
create policy "members read their challenge" on public.challenges
  for select using (public.is_challenge_member(id));

drop policy if exists "members read their squad" on public.challenge_members;
create policy "members read their squad" on public.challenge_members
  for select using (public.is_challenge_member(challenge_id));

drop policy if exists "read own day stats" on public.challenge_day_stats;
create policy "read own day stats" on public.challenge_day_stats
  for select using (user_id = auth.uid());

revoke insert, update, delete on public.challenges from anon, authenticated;
revoke insert, update, delete on public.challenge_members from anon, authenticated;
revoke insert, update, delete on public.challenge_day_stats from anon, authenticated;

-- -- functions ------------------------------------------------------------?

-- True if the signed-in user is already in a lobby or a running challenge.
create or replace function public._in_open_challenge(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.challenge_members m
    join public.challenges c on c.id = m.challenge_id
    where m.user_id = uid
      and m.status = 'active'
      and (c.status = 'lobby' or c.start_at + make_interval(days => c.days) > now())
  );
$$;

create or replace function public.server_now()
returns timestamptz
language sql
stable
as $$ select now(); $$;

-- Solo: starts right away (or at p_start_at). Squad: opens a lobby with a code.
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
  v_code text;
  v_ch public.challenges;
  v_name text;
  v_avatar text;
  tries int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_mode not in ('solo', 'squad') then raise exception 'bad mode'; end if;
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

  select name, avatar into v_name, v_avatar from public.user_data where id = uid;

  insert into public.challenges (code, creator_id, mode, status, start_at)
  values (
    v_code, uid, p_mode,
    case when p_mode = 'solo' then 'active' else 'lobby' end,
    case when p_mode = 'solo' then coalesce(p_start_at, now()) else null end
  )
  returning * into v_ch;

  insert into public.challenge_members (challenge_id, user_id, name, avatar, apps)
  values (v_ch.id, uid, coalesce(v_name, 'Anonymous'), coalesce(v_avatar, 'star'), coalesce(p_apps, '{}'));

  return v_ch;
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
  v_ch public.challenges;
  v_name text;
  v_avatar text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if public._in_open_challenge(uid) then raise exception 'already in a challenge'; end if;

  select * into v_ch from public.challenges
  where code = upper(trim(p_code)) and mode = 'squad' and status = 'lobby';
  if not found then raise exception 'code not found, or that squad already started'; end if;

  if (select count(*) from public.challenge_members where challenge_id = v_ch.id) >= 6 then
    raise exception 'this squad is full (6 max)';
  end if;

  select name, avatar into v_name, v_avatar from public.user_data where id = uid;

  insert into public.challenge_members (challenge_id, user_id, name, avatar, apps)
  values (v_ch.id, uid, coalesce(v_name, 'Anonymous'), coalesce(v_avatar, 'star'), coalesce(p_apps, '{}'));

  return v_ch;
end;
$$;

-- Creator only. Locks the squad: nobody can join after this.
create or replace function public.start_challenge(p_id uuid)
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ch public.challenges;
begin
  update public.challenges
  set status = 'active', start_at = now()
  where id = p_id and creator_id = auth.uid() and status = 'lobby'
  returning * into v_ch;
  if not found then raise exception 'only the squad creator can start a squad in its lobby'; end if;
  return v_ch;
end;
$$;

-- Lobby only: a member leaves; if the creator leaves, the lobby closes.
create or replace function public.leave_lobby(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if not exists (select 1 from public.challenges where id = p_id and status = 'lobby') then
    return;
  end if;
  if exists (select 1 from public.challenges where id = p_id and creator_id = uid) then
    delete from public.challenges where id = p_id;
  else
    delete from public.challenge_members where challenge_id = p_id and user_id = uid;
  end if;
end;
$$;

create or replace function public.quit_challenge(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.challenge_members
  set status = 'quit', quit_at = now()
  where challenge_id = p_id and user_id = auth.uid() and status = 'active';
$$;

-- Still going: the phone calls this when the app opens and every few hours.
create or replace function public.touch_challenge(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.challenge_members
  set last_seen_at = now()
  where challenge_id = p_id and user_id = auth.uid();
$$;

-- The phones own before-snapshot / final report / emergency count.
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
  update public.challenge_members
  set baseline = coalesce(baseline, p_baseline),
      report = coalesce(p_report, report),
      emergency_used = coalesce(p_emergency_used, emergency_used)
  where challenge_id = p_id and user_id = auth.uid();
$$;

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
  insert into public.challenge_day_stats (challenge_id, user_id, day, opens, per_app)
  values (p_id, auth.uid(), p_day, greatest(p_opens, 0), coalesce(p_per_app, '{}'::jsonb))
  on conflict (challenge_id, user_id, day)
  do update set opens = excluded.opens, per_app = excluded.per_app;
end;
$$;

-- Only signed-in users can call any of these.
revoke all on function public._in_open_challenge(uuid) from public, anon;
revoke all on function public.server_now() from public, anon;
revoke all on function public.create_challenge(text, text[], timestamptz) from public, anon;
revoke all on function public.join_challenge(text, text[]) from public, anon;
revoke all on function public.start_challenge(uuid) from public, anon;
revoke all on function public.leave_lobby(uuid) from public, anon;
revoke all on function public.quit_challenge(uuid) from public, anon;
revoke all on function public.touch_challenge(uuid) from public, anon;
revoke all on function public.save_challenge_member_data(uuid, jsonb, jsonb, int) from public, anon;
revoke all on function public.upload_day_stats(uuid, text, int, jsonb) from public, anon;
grant execute on function public.server_now() to authenticated;
grant execute on function public.create_challenge(text, text[], timestamptz) to authenticated;
grant execute on function public.join_challenge(text, text[]) to authenticated;
grant execute on function public.start_challenge(uuid) to authenticated;
grant execute on function public.leave_lobby(uuid) to authenticated;
grant execute on function public.quit_challenge(uuid) to authenticated;
grant execute on function public.touch_challenge(uuid) to authenticated;
grant execute on function public.save_challenge_member_data(uuid, jsonb, jsonb, int) to authenticated;
grant execute on function public.upload_day_stats(uuid, text, int, jsonb) to authenticated;
