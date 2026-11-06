-- Reading time (spec 3B §5): the seconds a member read, per local day,
-- device and book. A device sends its running totals and the largest one
-- stays, so a resend never counts twice. book_id has no foreign key on
-- purpose: deleting a book keeps the days read and the streak (spec 3B §5.1).
create table public.reading_time (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  device_id uuid not null,
  book_id uuid not null,
  seconds integer not null check (seconds between 0 and 86400),
  -- The member's daily goal when the row was last written: a day keeps the
  -- goal it had (spec 3B §3.2).
  goal_minutes smallint check (goal_minutes in (5, 10, 15, 20, 30, 45, 60)),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, device_id, book_id)
);

alter table public.reading_time enable row level security;

create policy reading_time_select_own on public.reading_time
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.reading_time from anon, authenticated;
grant select on table public.reading_time to authenticated;

-- Personal goals (spec 3B §3.4); null is no goal.
alter table public.profiles
  add column daily_goal_minutes smallint
    check (daily_goal_minutes in (5, 10, 15, 20, 30, 45, 60)),
  add column yearly_goal_books smallint
    check (yearly_goal_books between 1 and 365);

grant update (daily_goal_minutes, yearly_goal_books)
  on table public.profiles to authenticated;

-- Stores a batch from a device's queue (at most 50) and answers each entry,
-- in order. An entry for another member's book, or for a day outside
-- [UTC today - 30, UTC today + 1], has nothing to keep and is 'ok', so it
-- leaves the queue. A broken entry is 'invalid', for that entry alone.
create function public.record_reading_time(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_results text[] := '{}';
  v_entry jsonb;
  v_day date;
  v_device_id uuid;
  v_book_id uuid;
  v_seconds integer;
  v_goal smallint;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value
    from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_day := (v_entry ->> 'day')::date;
      v_device_id := (v_entry ->> 'device_id')::uuid;
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_seconds := (v_entry ->> 'seconds')::integer;
      v_goal := (v_entry ->> 'goal_minutes')::smallint;
      if v_day is null or v_device_id is null or v_book_id is null
        or v_seconds is null then
        raise exception 'invalid' using errcode = '22023';
      end if;

      if v_day between v_today - 30 and v_today + 1
        and exists (
          select 1 from public.books b
          where b.id = v_book_id and b.user_id = v_user_id
        ) then
        insert into public.reading_time as rt
          (user_id, day, device_id, book_id, seconds, goal_minutes, updated_at)
        values
          (v_user_id, v_day, v_device_id, v_book_id, v_seconds, v_goal, now())
        on conflict (user_id, day, device_id, book_id) do update
          set seconds = greatest(rt.seconds, excluded.seconds),
              goal_minutes = excluded.goal_minutes,
              updated_at = excluded.updated_at;
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_datetime_format
        or datetime_field_overflow
        or numeric_value_out_of_range
        or check_violation
        or invalid_parameter_value then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- The member's reading per day: every device and book added up, at most a
-- whole day, with the goal of the row written last that day.
create function public.reading_days()
returns table (day date, seconds integer, goal_minutes smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rt.day,
    least(sum(rt.seconds), 86400)::integer,
    (array_agg(rt.goal_minutes
      order by rt.updated_at desc, rt.goal_minutes desc nulls last))[1]
  from public.reading_time rt
  where rt.user_id = (select auth.uid())
  group by rt.day
  order by rt.day
$$;

revoke execute on function public.record_reading_time(jsonb) from public, anon;
grant execute on function public.record_reading_time(jsonb) to authenticated;
revoke execute on function public.reading_days() from public, anon;
grant execute on function public.reading_days() to authenticated;
