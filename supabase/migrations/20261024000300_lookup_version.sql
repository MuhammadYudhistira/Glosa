-- Every answer of lookup_word also names the dictionary it came from: when it
-- was imported, or null before the first import. A device keeps its meanings
-- cache for one dictionary and empties it when the version changes, so empty
-- answers from before an import do not stay (spec 2 §5). Additive: the same
-- function and grants, one more key.
create or replace function public.lookup_word(p_word text, p_next text[] default '{}')
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
  v_version timestamptz := (select m.imported_at from public.dict_meta m);
begin
  if p_word is null or char_length(p_word) not between 1 and 64 or v_next > 2 then
    return jsonb_build_object(
      'word', p_word, 'entries', v_entries, 'phrases', v_phrases, 'version', v_version
    );
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

  return jsonb_build_object(
      'word', p_word, 'entries', v_entries, 'phrases', v_phrases, 'version', v_version
    );
end;
$$;

revoke execute on function public.lookup_word(text, text[]) from public, anon;
grant execute on function public.lookup_word(text, text[]) to authenticated;
