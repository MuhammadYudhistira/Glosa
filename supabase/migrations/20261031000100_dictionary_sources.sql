-- Three sources for the dictionary (spec kamus tiga sumber §3): English
-- Wiktionary, WordNet Bahasa, and meanings made once by AI. Only adds: a
-- column with a default, two tables, one function, and new bodies for
-- lookup_word and dict_swap with the same signatures and grants.
alter table public.dict_entries
  add column source text not null default 'wiktionary'
  check (source in ('wiktionary', 'wordnet', 'ai'));
alter table public.dict_entries_staging
  add column source text not null default 'wiktionary';

-- Meanings made by AI (spec §3.2). Kept for good: dict_swap never touches
-- it, and the import reads it. Empty meanings: the AI found no Indonesian
-- equivalent, so the word is not asked again. Only the service role
-- (scripts) reads and writes it.
create table public.dict_generated (
  headword text not null check (char_length(headword) between 1 and 64),
  pos text not null check (
    pos in (
      'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase',
      'article', 'det', 'num', 'particle'
    )
  ),
  meanings text[] not null check (cardinality(meanings) between 0 and 8),
  model text not null check (char_length(model) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (headword, pos)
);

-- Words looked up without a meaning (spec §3.3), with no one's identity: the
-- word, how often, and when last. Picks the words the AI is asked next.
create table public.dict_misses (
  word text primary key check (char_length(word) between 1 and 64),
  lookups integer not null default 1 check (lookups > 0),
  last_seen timestamptz not null default now()
);

alter table public.dict_generated enable row level security;
alter table public.dict_misses enable row level security;
revoke all on table public.dict_generated, public.dict_misses
  from anon, authenticated;

-- Counts one lookup of a word without a meaning. Members may call it (the
-- lookup runs as them), so it checks again that the word has none.
create function public.dict_note_miss(p_word text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_word is null or char_length(p_word) not between 1 and 64 then
    return;
  end if;
  if exists (select 1 from public.dict_forms f where f.form = p_word) then
    return;
  end if;
  insert into public.dict_misses as m (word) values (p_word)
  on conflict (word) do update
    set lookups = m.lookups + 1, last_seen = now();
end;
$$;

revoke execute on function public.dict_note_miss(text) from public, anon;
grant execute on function public.dict_note_miss(text) to authenticated;

-- Each entry names its source, and a word without a meaning is counted
-- (spec §3.1, §3.3). Volatile now: it writes, and PostgREST runs stable
-- functions read-only. Counting never fails the lookup.
create or replace function public.lookup_word(p_word text, p_next text[] default '{}')
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_entries jsonb := '[]'::jsonb;
  v_phrases jsonb := '[]'::jsonb;
  v_next integer := coalesce(cardinality(p_next), 0);
  v_version timestamptz := (select m.imported_at from public.dict_meta m);
begin
  if p_word is null or char_length(p_word) not between 1 and 64 or v_next > 2 then
    return jsonb_build_object(
      'word', p_word, 'entries', v_entries, 'phrases', v_phrases, 'version', v_version
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'headword', e.headword,
        'pos', e.pos,
        'meanings', to_jsonb(e.meanings),
        'source', e.source
      )
      order by public.dict_pos_rank(e.pos), e.headword <> p_word, e.headword
    ),
    '[]'::jsonb
  )
  into v_entries
  from (select distinct f.headword, f.pos from public.dict_forms f where f.form = p_word) b
  join public.dict_entries e on e.headword = b.headword and e.pos = b.pos;

  if v_entries = '[]'::jsonb then
    begin
      perform public.dict_note_miss(p_word);
    exception when others then
      null;
    end;
  end if;

  if v_next > 0 then
    with heads as (
      select f.headword from public.dict_forms f where f.form = p_word
      union
      select p_word
    ),
    candidates as (
      select h.headword || ' ' || p_next[1] as phrase from heads h
      union
      select h.headword || ' ' || p_next[1] || ' ' || p_next[2]
      from heads h
      where v_next = 2
    ),
    found as (
      select
        e.headword,
        (jsonb_agg(to_jsonb(e.meanings) order by public.dict_pos_rank(e.pos)))->0 as meanings
      from public.dict_entries e
      where e.headword in (select c.phrase from candidates c where c.phrase is not null)
      group by e.headword
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object('headword', p.headword, 'meanings', p.meanings)
        order by cardinality(string_to_array(p.headword, ' ')) desc, p.headword
      ),
      '[]'::jsonb
    )
    into v_phrases
    from found p;
  end if;

  return jsonb_build_object(
      'word', p_word, 'entries', v_entries, 'phrases', v_phrases, 'version', v_version
    );
end;
$$;

revoke execute on function public.lookup_word(text, text[]) from public, anon;
grant execute on function public.lookup_word(text, text[]) to authenticated;

-- The same swap, carrying each entry's source along.
create or replace function public.dict_swap(
  p_source text,
  p_dump_date date default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entries integer;
  v_forms integer;
  v_previous integer;
begin
  select count(*) into v_entries
  from (select distinct s.headword, s.pos from public.dict_entries_staging s) d;
  if v_entries = 0 then
    raise exception 'empty' using errcode = 'P0001';
  end if;
  select m.entries into v_previous from public.dict_meta m;
  if not p_force and v_previous is not null and v_entries < v_previous * 0.8 then
    raise exception 'shrunk' using errcode = 'P0001';
  end if;

  truncate public.dict_forms, public.dict_entries;
  insert into public.dict_entries (headword, pos, meanings, source)
  select distinct on (s.headword, s.pos) s.headword, s.pos, s.meanings, s.source
  from public.dict_entries_staging s
  order by s.headword, s.pos;
  insert into public.dict_forms (form, headword, pos)
  select distinct s.form, s.headword, s.pos
  from public.dict_forms_staging s
  join public.dict_entries e on e.headword = s.headword and e.pos = s.pos;
  insert into public.dict_forms (form, headword, pos)
  select e.headword, e.headword, e.pos from public.dict_entries e
  on conflict do nothing;
  select count(*) into v_forms from public.dict_forms;

  insert into public.dict_meta (id, source, dump_date, entries, forms, imported_at)
  values (true, p_source, p_dump_date, v_entries, v_forms, now())
  on conflict (id) do update
    set source = excluded.source,
        dump_date = excluded.dump_date,
        entries = excluded.entries,
        forms = excluded.forms,
        imported_at = excluded.imported_at;
  truncate public.dict_entries_staging, public.dict_forms_staging;

  return jsonb_build_object('entries', v_entries, 'forms', v_forms, 'previous', v_previous);
end;
$$;

revoke execute on function public.dict_swap(text, date, boolean)
  from public, anon, authenticated;
grant execute on function public.dict_swap(text, date, boolean) to service_role;
