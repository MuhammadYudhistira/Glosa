-- Fixes to vocabulary from reading (review of 3D). Additive: the functions
-- below are replaced, no table changes.

-- The two summaries answer one jsonb object, not rows: PostgREST stops at
-- 1,000 rows (the pattern of saved_word_forms).
drop function public.book_vocab_summaries();
drop function public.word_meeting_counts();

-- { book_id: { read, looked_up } } for every book of the member with words
-- read or looked up.
create function public.book_vocab_summaries()
returns jsonb
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
  return coalesce((
    select jsonb_object_agg(
      s.book_id,
      jsonb_build_object('read', s.read, 'looked_up', s.looked_up)
    )
    from (
      select
        b.id as book_id,
        coalesce(cardinality(r.words), 0)::integer as read,
        (
          select count(*)::integer from public.word_lookups l
          where l.user_id = v_user_id and l.book_id = b.id
            and r.words is not null and l.word = any (r.words)
        ) as looked_up
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
    ) s
  ), '{}'::jsonb);
end;
$$;

-- { headword: { meetings, books } } for the member's saved words.
create function public.word_meeting_counts()
returns jsonb
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
  return coalesce((
    select jsonb_object_agg(
      w.headword,
      jsonb_build_object('meetings', w.meetings, 'books', w.books)
    )
    from (
      select
        m.headword,
        sum(m.count)::integer as meetings,
        count(distinct m.book_id)::integer as books
      from public.word_meetings m
      where m.user_id = v_user_id
      group by m.headword
    ) w
  ), '{}'::jsonb);
end;
$$;

-- As before, and now the section where a word was saved does not count
-- either: the saved place's spine step epubcfi(/6/N...) is section N / 2 - 1
-- (spec 3D §3.4), so the device sends meetings for every saved word.
create or replace function public.record_meetings(p_entries jsonb)
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
        )
        and not exists (
          select 1 from public.saved_words s
          where s.user_id = v_user_id and s.headword = v_headword
            and s.book_id = v_book_id
            and s.cfi ~ '^epubcfi\(/6/[0-9]+'
            and (substring(s.cfi from '^epubcfi\(/6/([0-9]+)'))::numeric >= 2
            and (substring(s.cfi from '^epubcfi\(/6/([0-9]+)'))::numeric % 2 = 0
            and (substring(s.cfi from '^epubcfi\(/6/([0-9]+)'))::numeric / 2 - 1
              = v_section
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

revoke execute on function public.book_vocab_summaries() from public, anon;
grant execute on function public.book_vocab_summaries() to authenticated;
revoke execute on function public.word_meeting_counts() from public, anon;
grant execute on function public.word_meeting_counts() to authenticated;
revoke execute on function public.record_meetings(jsonb) from public, anon;
grant execute on function public.record_meetings(jsonb) to authenticated;
