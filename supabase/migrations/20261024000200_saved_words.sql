-- Saved words (spec 2 §4.2): one row per member and headword, with the
-- meanings copied from the dictionary and the sentence it was found in.
-- Members read their own rows; writes go through save_word and delete_word.
create table public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  headword text not null check (char_length(headword) between 1 and 64),
  pos text check (
    pos in ('noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase')
  ),
  meanings text[] not null default '{}' check (cardinality(meanings) <= 8),
  -- The words stay when their book goes (spec 2 §2, decision 8).
  book_id uuid references public.books (id) on delete set null,
  book_title text check (char_length(book_title) <= 300),
  sentence text not null default '' check (char_length(sentence) <= 500),
  cfi text check (char_length(cfi) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique (user_id, headword)
);

create index saved_words_book_id_idx on public.saved_words (book_id);

alter table public.saved_words enable row level security;

create policy saved_words_select_own on public.saved_words
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.saved_words from anon, authenticated;
grant select on table public.saved_words to authenticated;

-- Saves a word unless the member has it already, in which case its first
-- context stays and the answer is still 'ok' (the queue may send it twice).
-- At most 5,000 words: the profile row is locked so two saves cannot both
-- pass the limit. The book's title is read from the member's own book; a book
-- gone in the meantime leaves the word without one.
-- Defaults, so the generated types let callers leave the optional ones out.
create function public.save_word(
  p_headword text,
  p_pos text default null,
  p_meanings text[] default '{}',
  p_book_id uuid default null,
  p_sentence text default '',
  p_cfi text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_book_id uuid;
  v_title text;
  v_owner uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles pr where pr.id = v_user_id for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.saved_words s
    where s.user_id = v_user_id and s.headword = p_headword
  ) then
    return 'ok';
  end if;
  if (select count(*) from public.saved_words s where s.user_id = v_user_id) >= 5000 then
    return 'limit_reached';
  end if;

  if p_book_id is not null then
    select b.user_id, b.title into v_owner, v_title
    from public.books b
    where b.id = p_book_id;
    if found and v_owner <> v_user_id then
      raise exception 'invalid' using errcode = 'P0001';
    end if;
    if found then
      v_book_id := p_book_id;
    end if;
  end if;

  insert into public.saved_words (
    user_id, headword, pos, meanings, book_id, book_title, sentence, cfi
  ) values (
    v_user_id, p_headword, p_pos, coalesce(p_meanings, '{}'), v_book_id,
    left(v_title, 300), coalesce(p_sentence, ''), p_cfi
  );
  return 'ok';
end;
$$;

create function public.delete_word(p_headword text)
returns void
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
  delete from public.saved_words s
  where s.user_id = v_user_id and s.headword = p_headword;
end;
$$;

-- Every form of the member's saved words, for the underline in books (spec 2
-- §6.5). One jsonb object, not rows: PostgREST stops at 1,000 rows.
create function public.saved_word_forms()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(w.headword, w.forms), '{}'::jsonb)
  from (
    select
      s.headword,
      to_jsonb(array(
        select f.form from public.dict_forms f where f.headword = s.headword
        union
        select s.headword
      )) as forms
    from public.saved_words s
    where s.user_id = (select auth.uid())
  ) w
$$;

revoke execute on function public.save_word(text, text, text[], uuid, text, text)
  from public, anon;
grant execute on function public.save_word(text, text, text[], uuid, text, text)
  to authenticated;
revoke execute on function public.delete_word(text) from public, anon;
grant execute on function public.delete_word(text) to authenticated;
revoke execute on function public.saved_word_forms() from public, anon;
grant execute on function public.saved_word_forms() to authenticated;
