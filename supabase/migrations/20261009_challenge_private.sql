-- Squad members could read each other's challenge_members rows, which also
-- held the before-snapshot of app usage, the final report and the emergency
-- count. Move those three into their own table that only the owner can
-- read. The squad-visible table keeps: username, avatar, chosen apps,
-- in or quit, join and quit times, last check-in.

create table if not exists public.challenge_member_private (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emergency_used int not null default 0,
  baseline jsonb,
  report jsonb,
  primary key (challenge_id, user_id)
);

alter table public.challenge_member_private enable row level security;

drop policy if exists "read own private challenge data" on public.challenge_member_private;
create policy "read own private challenge data" on public.challenge_member_private
  for select using (user_id = auth.uid());

revoke insert, update, delete on public.challenge_member_private from anon, authenticated;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'challenge_members' and column_name = 'baseline') then
    insert into public.challenge_member_private (challenge_id, user_id, emergency_used, baseline, report)
    select challenge_id, user_id, emergency_used, baseline, report from public.challenge_members
    on conflict do nothing;
    alter table public.challenge_members drop column emergency_used;
    alter table public.challenge_members drop column baseline;
    alter table public.challenge_members drop column report;
  end if;
end $$;

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
  on conflict (challenge_id, user_id) do update
  set baseline = coalesce(t.baseline, excluded.baseline),
      report = coalesce(excluded.report, t.report),
      emergency_used = case when p_emergency_used is null then t.emergency_used else excluded.emergency_used end;
$$;

revoke all on function public.save_challenge_member_data(uuid, jsonb, jsonb, int) from public, anon;
grant execute on function public.save_challenge_member_data(uuid, jsonb, jsonb, int) to authenticated;
