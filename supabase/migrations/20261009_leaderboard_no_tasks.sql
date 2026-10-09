-- The leaderboard, friends list and friend search only need how many tasks
-- were done each day, not the tasks themselves. Strip the task list from
-- the history they expose so nobody can read anyone else's task names.

create or replace function public.public_history(p_history jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (select jsonb_agg(h - 'tasks')
     from jsonb_array_elements(
       case when jsonb_typeof(p_history) = 'array' then p_history else '[]'::jsonb end
     ) h),
    '[]'::jsonb
  );
$$;

create or replace view public.leaderboard_view as
select u.id, u.name, u.avatar, u.exams, u.streak, public.public_history(u.history) as history,
       u.total_tasks_completed,
       fs.today_mins as focus_today_mins,
       fs.week_mins as focus_week_mins,
       fs.alltime_mins as focus_alltime_mins
from public.user_data u
cross join lateral public.focus_stats_from_log(u.focus_log) fs;

grant select on public.leaderboard_view to authenticated;

create or replace function public.friends_leaderboard()
returns table (
  id uuid, name text, avatar text, exams text[], streak int, history jsonb, total_tasks_completed int,
  focus_today_mins double precision, focus_week_mins double precision, focus_alltime_mins double precision
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.avatar, u.exams, u.streak, public.public_history(u.history), u.total_tasks_completed,
         fs.today_mins, fs.week_mins, fs.alltime_mins
  from public.user_data u
  join public.friendships f on f.friend_id = u.id
  cross join lateral public.focus_stats_from_log(u.focus_log) fs
  where f.user_id = auth.uid();
$$;

grant execute on function public.friends_leaderboard() to authenticated;

create or replace function public.find_user_by_email(p_email text)
returns table (
  id uuid, name text, avatar text, exams text[], streak int, history jsonb, total_tasks_completed int,
  focus_today_mins double precision, focus_week_mins double precision, focus_alltime_mins double precision
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.name, u.avatar, u.exams, u.streak, public.public_history(u.history), u.total_tasks_completed,
         fs.today_mins, fs.week_mins, fs.alltime_mins
  from public.user_data u
  cross join lateral public.focus_stats_from_log(u.focus_log) fs
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

grant execute on function public.find_user_by_email(text) to authenticated;
