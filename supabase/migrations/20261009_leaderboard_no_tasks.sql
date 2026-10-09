-- The leaderboard only needs how many tasks were done each day, not the
-- tasks themselves. Strip the task list from the history it exposes so
-- other users cannot read anyone else's task names.
create or replace view public.leaderboard_view as
select u.id, u.name, u.avatar, u.exams, u.streak,
       coalesce(
         (select jsonb_agg(h - 'tasks')
          from jsonb_array_elements(
            case when jsonb_typeof(u.history) = 'array' then u.history else '[]'::jsonb end
          ) h),
         '[]'::jsonb
       ) as history,
       u.total_tasks_completed,
       fs.today_mins as focus_today_mins,
       fs.week_mins as focus_week_mins,
       fs.alltime_mins as focus_alltime_mins
from public.user_data u
cross join lateral public.focus_stats_from_log(u.focus_log) fs;

grant select on public.leaderboard_view to authenticated;
