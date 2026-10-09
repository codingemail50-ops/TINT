-- Delete account (required by Google Play for apps with sign-up).
-- Idempotent. Run in the Supabase SQL Editor and choose Run without RLS
-- (this file creates no tables).
--
-- Deleting the auth user cascades to user_data, friend_requests, challenge
-- memberships and day stats. A squad someone made keeps running for the
-- others: its creator is just cleared. An unstarted lobby they made is
-- closed.

alter table public.challenges alter column creator_id drop not null;
alter table public.challenges drop constraint if exists challenges_creator_id_fkey;
alter table public.challenges
  add constraint challenges_creator_id_fkey
  foreign key (creator_id) references auth.users(id) on delete set null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  delete from public.challenges where creator_id = uid and status = 'lobby';
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
