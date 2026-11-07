-- Finished-book card, private review and recap (spec 3E §6). Additive only.

-- A member's private review of a finished book (spec 3E §4, §6.1). One per
-- book. No public column: Tahap 4 adds it. Written only by save_review.
create table public.book_reviews (
  book_id uuid primary key references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index book_reviews_user_id_idx on public.book_reviews (user_id);

alter table public.book_reviews enable row level security;

create policy book_reviews_select_own on public.book_reviews
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.book_reviews from anon, authenticated;
grant select on table public.book_reviews to authenticated;

-- When a meeting row was first written; the recap counts meetings by it.
-- record_meetings never sets it, so a larger count leaves it alone.
alter table public.word_meetings
  add column met_at timestamptz not null default now();

-- Saves or changes the review of one of the member's finished books.
-- 'ok', 'not_found' (not the member's book), 'not_finished' or 'invalid'
-- (rating, difficulty or note outside the rules). A blank note is null.
create function public.save_review(
  p_book_id uuid,
  p_rating integer,
  p_difficulty text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_finished timestamptz;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select b.finished_at into v_finished
  from public.books b
  where b.id = p_book_id and b.user_id = v_user_id;
  if not found then
    return 'not_found';
  end if;
  if v_finished is null then
    return 'not_finished';
  end if;
  if p_rating is null or p_rating not between 1 and 5
    or (p_difficulty is not null
      and p_difficulty not in ('easy', 'medium', 'hard'))
    or (v_note is not null and char_length(v_note) > 2000) then
    return 'invalid';
  end if;

  insert into public.book_reviews as r
    (book_id, user_id, rating, difficulty, note)
  values (p_book_id, v_user_id, p_rating, p_difficulty, v_note)
  on conflict (book_id) do update
    set rating = excluded.rating,
        difficulty = excluded.difficulty,
        note = excluded.note,
        updated_at = now();
  return 'ok';
end;
$$;

-- Removes the review; 'ok' also when there was none, 'not_found' when the
-- book is not the member's.
create function public.delete_review(p_book_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.books b
    where b.id = p_book_id and b.user_id = v_user_id
  ) then
    return 'not_found';
  end if;
  delete from public.book_reviews r
  where r.book_id = p_book_id and r.user_id = v_user_id;
  return 'ok';
end;
$$;

-- The numbers of the finished-book card (spec 3E §3.2) in one answer, or
-- null for a book that is not the member's. The coin bonus is awarded first
-- (idempotent), so "+50 koin" is right the moment a book is finished. The
-- member's review comes along, and the first 12 saved words of the book.
create function public.book_finish_summary(p_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_finished timestamptz;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select b.finished_at into v_finished
  from public.books b
  where b.id = p_book_id and b.user_id = v_user_id;
  if not found then
    return null;
  end if;
  perform public.award_book_coins(v_user_id);

  return jsonb_build_object(
    'seconds', (
      select coalesce(sum(rt.seconds), 0)::integer
      from public.reading_time rt
      where rt.user_id = v_user_id and rt.book_id = p_book_id
    ),
    'days', (
      select count(distinct rt.day)::integer
      from public.reading_time rt
      where rt.user_id = v_user_id and rt.book_id = p_book_id
        and rt.seconds > 0
    ),
    'looked_up', (
      select count(*)::integer
      from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = p_book_id
    ),
    'saved', (
      select count(*)::integer
      from public.saved_words s
      where s.user_id = v_user_id and s.book_id = p_book_id
    ),
    'words', coalesce((
      select jsonb_agg(w.headword order by w.created_at, w.headword)
      from (
        select s.headword, s.created_at
        from public.saved_words s
        where s.user_id = v_user_id and s.book_id = p_book_id
        order by s.created_at, s.headword
        limit 12
      ) w
    ), '[]'::jsonb),
    'coins', coalesce((
      select a.coins from public.coin_awards a
      where a.user_id = v_user_id and a.book_id = p_book_id
    ), 0),
    'finished_at', v_finished,
    'review', (
      select jsonb_build_object(
        'rating', r.rating,
        'difficulty', r.difficulty,
        'note', r.note,
        'updated_at', r.updated_at
      )
      from public.book_reviews r
      where r.book_id = p_book_id and r.user_id = v_user_id
    )
  );
end;
$$;

-- The recap of local days p_from..p_to (both included) in zone p_tz
-- (spec 3E §5, §6.2): one object. Days come from reading_time as the habit
-- reads them; every other time is cut at the zone's midnight. A range over
-- 366 days, a backwards range or an unknown zone is 'invalid'.
create function public.reading_recap(p_from date, p_to date, p_tz text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_start timestamptz;
  v_end timestamptz;
  v_top jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_tz is null
    or p_to < p_from or p_to - p_from > 366
    or not exists (
      select 1 from pg_catalog.pg_timezone_names n where n.name = p_tz
    ) then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  v_start := p_from::timestamp at time zone p_tz;
  v_end := (p_to + 1)::timestamp at time zone p_tz;

  select jsonb_build_object('headword', m.headword, 'meetings', m.total)
  into v_top
  from (
    select wm.headword, sum(wm.count)::integer as total
    from public.word_meetings wm
    where wm.user_id = v_user_id
      and wm.met_at >= v_start and wm.met_at < v_end
    group by wm.headword
    order by total desc, wm.headword asc
    limit 1
  ) m;

  return jsonb_build_object(
    'days', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'seconds', d.seconds,
          'goal_minutes', d.goal_minutes
        ) order by d.day
      )
      from (
        select
          rt.day,
          least(sum(rt.seconds), 86400)::integer as seconds,
          (array_agg(rt.goal_minutes
            order by rt.updated_at desc, rt.goal_minutes desc nulls last))[1]
            as goal_minutes
        from public.reading_time rt
        where rt.user_id = v_user_id and rt.day between p_from and p_to
        group by rt.day
      ) d
    ), '[]'::jsonb),
    'books', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', b.id, 'finished_at', b.finished_at)
        order by b.finished_at desc
      )
      from public.books b
      where b.user_id = v_user_id
        and b.finished_at >= v_start and b.finished_at < v_end
    ), '[]'::jsonb),
    'looked_up', (
      select count(*)::integer
      from (
        select l.word, min(l.first_at) as first_at
        from public.word_lookups l
        where l.user_id = v_user_id
        group by l.word
      ) f
      where f.first_at >= v_start and f.first_at < v_end
    ),
    'saved', (
      select count(*)::integer
      from public.saved_words s
      where s.user_id = v_user_id
        and s.created_at >= v_start and s.created_at < v_end
    ),
    'top_meeting', v_top,
    'first_day', (
      select min(rt.day)
      from public.reading_time rt
      where rt.user_id = v_user_id
    )
  );
end;
$$;

revoke execute on function public.save_review(uuid, integer, text, text) from public, anon;
grant execute on function public.save_review(uuid, integer, text, text) to authenticated;
revoke execute on function public.delete_review(uuid) from public, anon;
grant execute on function public.delete_review(uuid) to authenticated;
revoke execute on function public.book_finish_summary(uuid) from public, anon;
grant execute on function public.book_finish_summary(uuid) to authenticated;
revoke execute on function public.reading_recap(date, date, text) from public, anon;
grant execute on function public.reading_recap(date, date, text) to authenticated;
