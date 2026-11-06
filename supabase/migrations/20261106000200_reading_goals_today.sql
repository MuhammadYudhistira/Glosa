-- Saving the goals (spec 3B §3.4): a new daily goal applies to today too, so
-- today's status is the same now and tomorrow. Earlier days keep their goal.
-- p_today is the member's local day; it must be within a day of UTC today.
create function public.set_reading_goals(
  p_daily smallint,
  p_yearly smallint,
  p_today date
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_utc_today date := (now() at time zone 'utc')::date;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_today is null
    or p_today not between v_utc_today - 1 and v_utc_today + 1
    or (p_daily is not null and p_daily not in (5, 10, 15, 20, 30, 45, 60))
    or (p_yearly is not null and p_yearly not between 1 and 365) then
    return 'invalid';
  end if;

  update public.profiles
    set daily_goal_minutes = p_daily,
        yearly_goal_books = p_yearly
    where id = v_user_id;
  update public.reading_time
    set goal_minutes = p_daily
    where user_id = v_user_id and day = p_today;
  return 'ok';
end;
$$;

revoke execute on function public.set_reading_goals(smallint, smallint, date)
  from public, anon;
grant execute on function public.set_reading_goals(smallint, smallint, date)
  to authenticated;
