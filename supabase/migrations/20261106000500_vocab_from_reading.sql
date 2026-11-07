-- Vocabulary from reading (spec 3D §5): the distinct words of the sections
-- a member read, the words they looked up, and how often saved words came
-- back. Written through functions only; each member reads their own rows.

create table public.book_words_read (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  -- Sections whose last part arrived; a section here is never added again.
  sections integer[] not null default '{}',
  words text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table public.word_lookups (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  word text not null check (char_length(word) between 1 and 64),
  taps integer not null check (taps > 0),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (user_id, book_id, word)
);

-- book_id has no foreign key, like reading_time: "in N books" stays true
-- after a book is deleted (spec 3D §5.1).
create table public.word_meetings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  headword text not null,
  book_id uuid not null,
  section integer not null check (section >= 0),
  count integer not null check (count > 0),
  primary key (user_id, headword, book_id, section)
);

alter table public.book_words_read enable row level security;
alter table public.word_lookups enable row level security;
alter table public.word_meetings enable row level security;
create policy book_words_read_select_own on public.book_words_read
  for select to authenticated using (user_id = (select auth.uid()));
create policy word_lookups_select_own on public.word_lookups
  for select to authenticated using (user_id = (select auth.uid()));
create policy word_meetings_select_own on public.word_meetings
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.book_words_read from anon, authenticated;
revoke all on table public.word_lookups from anon, authenticated;
revoke all on table public.word_meetings from anon, authenticated;
grant select on table public.book_words_read to authenticated;
grant select on table public.word_lookups to authenticated;
grant select on table public.word_meetings to authenticated;

-- A word leaving Kosakata takes its meetings along (spec 3D §3.4).
create function public.drop_word_meetings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.word_meetings m
  where m.user_id = old.user_id and m.headword = old.headword;
  return old;
end;
$$;
create trigger saved_words_drop_meetings
  after delete on public.saved_words
  for each row execute function public.drop_word_meetings();
revoke execute on function public.drop_word_meetings()
  from public, anon, authenticated;

-- One answer per entry, in order (the queue pattern of 3B). An entry for
-- another member's book has nothing to keep and is 'ok'. A section already
-- in `sections` is ignored; a section joins `sections` with its last part,
-- so parts sent again are harmless.
create function public.record_words_read(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_book_id uuid;
  v_section integer;
  v_last boolean;
  v_words text[];
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 10 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_section := (v_entry ->> 'section')::integer;
      v_last := (v_entry ->> 'last')::boolean;
      if v_book_id is null or v_section is null or v_section < 0
        or v_last is null
        or jsonb_typeof(v_entry -> 'words') is distinct from 'array'
        or jsonb_array_length(v_entry -> 'words') > 5000 then
        raise exception 'invalid' using errcode = '22023';
      end if;
      select coalesce(array_agg(w.value), '{}') into v_words
      from jsonb_array_elements_text(v_entry -> 'words') as w (value);
      if exists (
        select 1 from unnest(v_words) as w (value)
        where w.value is null or char_length(w.value) not between 1 and 64
      ) then
        raise exception 'invalid' using errcode = '22023';
      end if;

      if exists (
        select 1 from public.books b
        where b.id = v_book_id and b.user_id = v_user_id
      ) then
        insert into public.book_words_read (user_id, book_id)
        values (v_user_id, v_book_id)
        on conflict (user_id, book_id) do nothing;
        update public.book_words_read r
        set
          words = (
            select coalesce(array_agg(distinct x.value), '{}')
            from unnest(r.words || v_words) as x (value)
          ),
          sections = case when v_last then r.sections || v_section else r.sections end,
          updated_at = now()
        where r.user_id = v_user_id
          and r.book_id = v_book_id
          and not (v_section = any (r.sections));
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_parameter_value
        or numeric_value_out_of_range then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- Taps add up; first_at and last_at widen (spec 3D §3.3).
create function public.record_lookups(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_book_id uuid;
  v_word text;
  v_taps integer;
  v_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_word := v_entry ->> 'word';
      v_taps := (v_entry ->> 'taps')::integer;
      v_at := (v_entry ->> 'at')::timestamptz;
      if v_book_id is null or v_word is null
        or char_length(v_word) not between 1 and 64
        or v_taps is null or v_taps not between 1 and 1000
        or v_at is null then
        raise exception 'invalid' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.books b
        where b.id = v_book_id and b.user_id = v_user_id
      ) then
        insert into public.word_lookups as l
          (user_id, book_id, word, taps, first_at, last_at)
        values (v_user_id, v_book_id, v_word, v_taps, v_at, v_at)
        on conflict (user_id, book_id, word) do update
          set taps = l.taps + excluded.taps,
              first_at = least(l.first_at, excluded.first_at),
              last_at = greatest(l.last_at, excluded.last_at);
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_datetime_format
        or datetime_field_overflow
        or invalid_parameter_value
        or numeric_value_out_of_range then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- The most meetings per (word, book, section); saved words of the member,
-- in their own books, only (spec 3D §3.4).
create function public.record_meetings(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_headword text;
  v_book_id uuid;
  v_section integer;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;

  for v_entry in
    select e.value from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      v_headword := v_entry ->> 'headword';
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_section := (v_entry ->> 'section')::integer;
      v_count := (v_entry ->> 'count')::integer;
      if v_headword is null or v_book_id is null
        or v_section is null or v_section < 0
        or v_count is null or v_count not between 1 and 10000 then
        raise exception 'invalid' using errcode = '22023';
      end if;
      if exists (
          select 1 from public.saved_words s
          where s.user_id = v_user_id and s.headword = v_headword
        )
        and exists (
          select 1 from public.books b
          where b.id = v_book_id and b.user_id = v_user_id
        ) then
        insert into public.word_meetings as m
          (user_id, headword, book_id, section, count)
        values (v_user_id, v_headword, v_book_id, v_section, v_count)
        on conflict (user_id, headword, book_id, section) do update
          set count = greatest(m.count, excluded.count);
      end if;
      v_results := v_results || 'ok'::text;
    exception
      when invalid_text_representation
        or invalid_parameter_value
        or numeric_value_out_of_range then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

-- One book's numbers and its looked-up words, the last tapped first; null
-- for a book that is not the member's (spec 3D §5.2). looked_up counts only
-- words that are in the book's words read (spec 3D §3.5).
create function public.book_vocab(p_book_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_words text[];
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.books b where b.id = p_book_id and b.user_id = v_user_id
  ) then
    return null;
  end if;
  select r.words into v_words
  from public.book_words_read r
  where r.user_id = v_user_id and r.book_id = p_book_id;
  v_words := coalesce(v_words, '{}');
  return jsonb_build_object(
    'read', cardinality(v_words),
    'looked_up', (
      select count(*) from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = p_book_id
        and l.word = any (v_words)
    ),
    'words', coalesce((
      select jsonb_agg(
        jsonb_build_object('word', l.word, 'taps', l.taps, 'last_at', l.last_at)
        order by l.last_at desc, l.word
      )
      from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = p_book_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Every book of the member with words read or looked up.
create function public.book_vocab_summaries()
returns table (book_id uuid, read integer, looked_up integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  return query
  select
    b.id,
    coalesce(cardinality(r.words), 0)::integer,
    (
      select count(*)::integer from public.word_lookups l
      where l.user_id = v_user_id and l.book_id = b.id
        and r.words is not null and l.word = any (r.words)
    )
  from public.books b
  left join public.book_words_read r
    on r.user_id = v_user_id and r.book_id = b.id
  where b.user_id = v_user_id
    and (
      r.book_id is not null
      or exists (
        select 1 from public.word_lookups l
        where l.user_id = v_user_id and l.book_id = b.id
      )
    )
  order by b.id;
end;
$$;

-- Meetings per saved word: how many, in how many books (spec 3D §4.2).
create function public.word_meeting_counts()
returns table (headword text, meetings integer, books integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  return query
  select m.headword, sum(m.count)::integer, count(distinct m.book_id)::integer
  from public.word_meetings m
  where m.user_id = v_user_id
  group by m.headword
  order by m.headword;
end;
$$;

revoke execute on function public.record_words_read(jsonb) from public, anon;
grant execute on function public.record_words_read(jsonb) to authenticated;
revoke execute on function public.record_lookups(jsonb) from public, anon;
grant execute on function public.record_lookups(jsonb) to authenticated;
revoke execute on function public.record_meetings(jsonb) from public, anon;
grant execute on function public.record_meetings(jsonb) to authenticated;
revoke execute on function public.book_vocab(uuid) from public, anon;
grant execute on function public.book_vocab(uuid) to authenticated;
revoke execute on function public.book_vocab_summaries() from public, anon;
grant execute on function public.book_vocab_summaries() to authenticated;
revoke execute on function public.word_meeting_counts() from public, anon;
grant execute on function public.word_meeting_counts() to authenticated;
