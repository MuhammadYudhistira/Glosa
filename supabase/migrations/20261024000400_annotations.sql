-- Annotations (spec 2 §4.3): highlights and bookmarks. The id is made on the
-- device, so a change made offline keeps its identity on the way. Members
-- read their own rows, tombstones included; every write goes through
-- save_annotations, where the newest change wins.
create table public.annotations (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Annotations mean nothing without their book (spec 2 §2, decision 8).
  book_id uuid not null references public.books (id) on delete cascade,
  kind text not null check (kind in ('highlight', 'bookmark')),
  cfi text not null check (char_length(cfi) between 1 and 2000),
  color text check (color in ('yellow', 'green', 'blue', 'pink')),
  note text not null default '' check (char_length(note) <= 2000),
  excerpt text not null default '' check (char_length(excerpt) <= 1000),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  -- A deletion stays as a tombstone, so it reaches devices that were offline.
  deleted_at timestamptz,
  -- A highlight has a colour and may have a note; a bookmark has neither.
  check ((kind = 'highlight') = (color is not null)),
  check (kind = 'highlight' or note = '')
);

create index annotations_user_book_idx on public.annotations (user_id, book_id);
create index annotations_book_id_idx on public.annotations (book_id);
create index annotations_deleted_at_idx on public.annotations (deleted_at)
  where deleted_at is not null;

alter table public.annotations enable row level security;

create policy annotations_select_own on public.annotations
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.annotations from anon, authenticated;
grant select on table public.annotations to authenticated;

-- Stores a batch of changes from a device's queue (at most 50) and answers
-- each one, in order: 'ok', 'limit_reached' or 'invalid'. A change is kept
-- only when it is newer than the stored one ("newest wins", by the device's
-- clock); a time from the future is clamped to now(), as in save_progress.
-- An older change, or one for a book deleted in the meantime, has nothing to
-- do and is 'ok'. Another member's id or book, a book not ready, and values
-- the table refuses are 'invalid', for that change alone, so one bad change
-- cannot hold up the queue behind it. At most 10,000 active annotations per
-- member: the profile row is locked so two batches cannot both pass it.
create function public.save_annotations(p_entries jsonb)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_results text[] := '{}';
  v_entry jsonb;
  v_id uuid;
  v_book_id uuid;
  v_updated_at timestamptz;
  v_deleted_at timestamptz;
  v_existing public.annotations;
  v_exists boolean;
  v_owner uuid;
  v_status text;
  v_active integer;
  v_delta integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or jsonb_array_length(p_entries) > 50 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles pr where pr.id = v_user_id for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select count(*) into v_active
  from public.annotations a
  where a.user_id = v_user_id and a.deleted_at is null;

  for v_entry in
    select e.value
    from jsonb_array_elements(p_entries) with ordinality as e (value, n)
    order by e.n
  loop
    begin
      if v_entry ->> 'id' is null
        or v_entry ->> 'book_id' is null
        or v_entry ->> 'updated_at' is null then
        raise exception 'invalid' using errcode = '22023';
      end if;
      v_id := (v_entry ->> 'id')::uuid;
      v_book_id := (v_entry ->> 'book_id')::uuid;
      v_updated_at := least((v_entry ->> 'updated_at')::timestamptz, now());
      -- least() skips nulls, so a missing deletion is kept apart.
      v_deleted_at := case
        when v_entry ->> 'deleted_at' is null then null
        else least((v_entry ->> 'deleted_at')::timestamptz, now())
      end;

      select * into v_existing from public.annotations a where a.id = v_id;
      v_exists := found;
      if v_exists and v_existing.user_id <> v_user_id then
        v_results := v_results || 'invalid'::text;
        continue;
      end if;
      if v_exists and v_existing.updated_at >= v_updated_at then
        v_results := v_results || 'ok'::text;
        continue;
      end if;

      select b.user_id, b.status into v_owner, v_status
      from public.books b
      where b.id = v_book_id;
      if not found then
        -- The book went in the meantime, and its annotations with it.
        v_results := v_results || 'ok'::text;
        continue;
      end if;
      if v_owner <> v_user_id
        or v_status <> 'ready'
        or (v_exists and v_existing.book_id <> v_book_id) then
        v_results := v_results || 'invalid'::text;
        continue;
      end if;

      v_delta := case
        when v_deleted_at is null
          and (not v_exists or v_existing.deleted_at is not null) then 1
        when v_deleted_at is not null
          and v_exists and v_existing.deleted_at is null then -1
        else 0
      end;
      if v_delta > 0 and v_active >= 10000 then
        v_results := v_results || 'limit_reached'::text;
        continue;
      end if;

      insert into public.annotations as an (
        id, user_id, book_id, kind, cfi, color, note, excerpt,
        created_at, updated_at, deleted_at
      ) values (
        v_id, v_user_id, v_book_id, v_entry ->> 'kind', v_entry ->> 'cfi',
        v_entry ->> 'color', coalesce(v_entry ->> 'note', ''),
        coalesce(v_entry ->> 'excerpt', ''),
        least(
          coalesce((v_entry ->> 'created_at')::timestamptz, v_updated_at),
          now()
        ),
        v_updated_at, v_deleted_at
      )
      on conflict (id) do update
        set color = excluded.color,
            note = excluded.note,
            excerpt = excluded.excerpt,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at
        where an.user_id = excluded.user_id
          and an.updated_at < excluded.updated_at;
      -- Counted only once the row is in: a refused insert changes nothing.
      v_active := v_active + v_delta;
      v_results := v_results || 'ok'::text;
    exception
      when data_exception or integrity_constraint_violation then
        v_results := v_results || 'invalid'::text;
    end;
  end loop;
  return v_results;
end;
$$;

revoke execute on function public.save_annotations(jsonb) from public, anon;
grant execute on function public.save_annotations(jsonb) to authenticated;
