-- Dictionary (spec 2 §4.1): English headwords with their Indonesian meanings,
-- from English Wiktionary (kaikki.org / wiktextract, CC BY-SA). Members only
-- read it; scripts/import-dictionary.ts fills it with the service role.
create table public.dict_entries (
  headword text not null check (char_length(headword) between 1 and 64),
  pos text not null check (
    pos in ('noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase')
  ),
  meanings text[] not null check (cardinality(meanings) between 1 and 8),
  primary key (headword, pos)
);

-- Every form that leads to a headword, the headword itself included, so a
-- lookup takes one query.
create table public.dict_forms (
  form text not null check (char_length(form) between 1 and 64),
  headword text not null,
  pos text not null,
  primary key (form, headword, pos),
  foreign key (headword, pos)
    references public.dict_entries (headword, pos) on delete cascade
);

create index dict_forms_headword_idx on public.dict_forms (headword);

-- One row: which extract the dictionary came from and how big it was.
create table public.dict_meta (
  id boolean primary key default true check (id),
  source text not null,
  dump_date date,
  entries integer not null,
  forms integer not null,
  imported_at timestamptz not null default now()
);

-- Filled by the import, then swapped in by dict_swap.
create table public.dict_entries_staging (
  headword text not null,
  pos text not null,
  meanings text[] not null
);

create table public.dict_forms_staging (
  form text not null,
  headword text not null,
  pos text not null
);

alter table public.dict_entries enable row level security;
alter table public.dict_forms enable row level security;
alter table public.dict_meta enable row level security;
alter table public.dict_entries_staging enable row level security;
alter table public.dict_forms_staging enable row level security;

create policy dict_entries_select on public.dict_entries
  for select to authenticated using (true);
create policy dict_forms_select on public.dict_forms
  for select to authenticated using (true);
create policy dict_meta_select on public.dict_meta
  for select to authenticated using (true);

revoke all on table
  public.dict_entries, public.dict_forms, public.dict_meta,
  public.dict_entries_staging, public.dict_forms_staging
  from anon, authenticated;
grant select on table public.dict_entries, public.dict_forms, public.dict_meta
  to authenticated;

-- The most common parts of speech first (spec 2 §4.1).
create function public.dict_pos_rank(p_pos text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_pos
    when 'verb' then 1
    when 'noun' then 2
    when 'adj' then 3
    when 'adv' then 4
    else 5
  end
$$;

-- What a tapped word means (spec 2 §4.1): the headwords its form leads to, and
-- the phrasal verbs that start with it and the next one or two words, longest
-- first. Anything too long answers nothing.
create function public.lookup_word(p_word text, p_next text[] default '{}')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_entries jsonb := '[]'::jsonb;
  v_phrases jsonb := '[]'::jsonb;
  v_next integer := coalesce(cardinality(p_next), 0);
begin
  if p_word is null or char_length(p_word) not between 1 and 64 or v_next > 2 then
    return jsonb_build_object('word', p_word, 'entries', v_entries, 'phrases', v_phrases);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('headword', e.headword, 'pos', e.pos, 'meanings', to_jsonb(e.meanings))
      order by public.dict_pos_rank(e.pos), e.headword <> p_word, e.headword
    ),
    '[]'::jsonb
  )
  into v_entries
  from (select distinct f.headword, f.pos from public.dict_forms f where f.form = p_word) b
  join public.dict_entries e on e.headword = b.headword and e.pos = b.pos;

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

  return jsonb_build_object('word', p_word, 'entries', v_entries, 'phrases', v_phrases);
end;
$$;

-- Empties the staging tables before an import.
create function public.dict_staging_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  truncate public.dict_entries_staging, public.dict_forms_staging;
end;
$$;

-- Replaces the dictionary with the staging tables in one transaction, so a
-- lookup never sees half of one (spec 2 §4.1). Every headword also becomes
-- its own form. Refuses a dictionary over 20% smaller than the last unless
-- forced.
create function public.dict_swap(
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
  insert into public.dict_entries (headword, pos, meanings)
  select distinct on (s.headword, s.pos) s.headword, s.pos, s.meanings
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

revoke execute on function public.dict_pos_rank(text) from public, anon;
grant execute on function public.dict_pos_rank(text) to authenticated;
revoke execute on function public.lookup_word(text, text[]) from public, anon;
grant execute on function public.lookup_word(text, text[]) to authenticated;
revoke execute on function public.dict_staging_reset() from public, anon, authenticated;
grant execute on function public.dict_staging_reset() to service_role;
revoke execute on function public.dict_swap(text, date, boolean)
  from public, anon, authenticated;
grant execute on function public.dict_swap(text, date, boolean) to service_role;
