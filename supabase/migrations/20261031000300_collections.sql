-- Collections (spec Tahap 3 §4.1, §5): lists the member makes and names, a
-- book in as many as they like. Members read their own rows; every write
-- goes through the functions below.
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- One name once per member, whatever its case.
create unique index collections_user_name_idx
  on public.collections (user_id, lower(name));

create table public.collection_books (
  collection_id uuid not null references public.collections (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, book_id)
);

create index collection_books_book_id_idx on public.collection_books (book_id);

alter table public.collections enable row level security;
alter table public.collection_books enable row level security;

create policy collections_select_own on public.collections
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy collection_books_select_own on public.collection_books
  for select to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.user_id = (select auth.uid())
  ));

revoke all on table public.collections from anon, authenticated;
revoke all on table public.collection_books from anon, authenticated;
grant select on table public.collections to authenticated;
grant select on table public.collection_books to authenticated;

-- Finished books (spec Tahap 3 §4.4). Outside the books update grant: only
-- set_book_finished and decline_finish write them.
alter table public.books
  add column finished_at timestamptz,
  add column finish_declined boolean not null default false;

-- Makes a collection and answers its id, or 'invalid' (empty or over 40
-- characters once trimmed), 'duplicate' (the name in any case) or
-- 'limit_reached' (50 already). The profile row is locked so two calls
-- cannot both pass the limit.
create function public.create_collection(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform 1 from public.profiles pr where pr.id = v_user_id for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 40 then
    return 'invalid';
  end if;
  if (select count(*) from public.collections c where c.user_id = v_user_id) >= 50 then
    return 'limit_reached';
  end if;
  begin
    insert into public.collections (user_id, name)
    values (v_user_id, v_name)
    returning id into v_id;
  exception when unique_violation then
    return 'duplicate';
  end;
  return v_id::text;
end;
$$;

create function public.rename_collection(p_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 40 then
    return 'invalid';
  end if;
  begin
    update public.collections c set name = v_name
    where c.id = p_id and c.user_id = v_user_id;
    get diagnostics v_count = row_count;
  exception when unique_violation then
    return 'duplicate';
  end;
  if v_count = 0 then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- The books stay; only their place in this collection goes (cascade).
create function public.delete_collection(p_id uuid)
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
  delete from public.collections c
  where c.id = p_id and c.user_id = v_user_id;
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- Puts a book in exactly these collections (the checklist in its details).
-- 'not_found' for anything but the member's own ready book, 'invalid' when
-- any collection is not theirs. Memberships that stay keep their added_at.
create function public.set_book_collections(
  p_book_id uuid,
  p_collection_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_ids uuid[] := coalesce(p_collection_ids, '{}');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform 1 from public.books b
  where b.id = p_book_id and b.user_id = v_user_id and b.status = 'ready';
  if not found then
    return 'not_found';
  end if;
  if exists (
    select 1 from unnest(v_ids) as wanted(id)
    where not exists (
      select 1 from public.collections c
      where c.id = wanted.id and c.user_id = v_user_id
    )
  ) then
    return 'invalid';
  end if;
  delete from public.collection_books cb
  where cb.book_id = p_book_id and not (cb.collection_id = any (v_ids));
  insert into public.collection_books (collection_id, book_id)
  select distinct wanted.id, p_book_id from unnest(v_ids) as wanted(id)
  on conflict do nothing;
  return 'ok';
end;
$$;

-- Finished keeps the first time; not finished clears it and the "Belum"
-- answer, so the reader may ask again.
create function public.set_book_finished(p_book_id uuid, p_finished boolean)
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
  update public.books b
  set
    finished_at = case when p_finished then coalesce(b.finished_at, now()) end,
    finish_declined = case when p_finished then b.finish_declined else false end
  where b.id = p_book_id and b.user_id = v_user_id and b.status = 'ready';
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- "Belum" to "Sudah selesai membaca buku ini?": the reader asks no more.
create function public.decline_finish(p_book_id uuid)
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
  update public.books b set finish_declined = true
  where b.id = p_book_id and b.user_id = v_user_id and b.status = 'ready';
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.create_collection(text) from public, anon;
grant execute on function public.create_collection(text) to authenticated;
revoke execute on function public.rename_collection(uuid, text) from public, anon;
grant execute on function public.rename_collection(uuid, text) to authenticated;
revoke execute on function public.delete_collection(uuid) from public, anon;
grant execute on function public.delete_collection(uuid) to authenticated;
revoke execute on function public.set_book_collections(uuid, uuid[]) from public, anon;
grant execute on function public.set_book_collections(uuid, uuid[]) to authenticated;
revoke execute on function public.set_book_finished(uuid, boolean) from public, anon;
grant execute on function public.set_book_finished(uuid, boolean) to authenticated;
revoke execute on function public.decline_finish(uuid) from public, anon;
grant execute on function public.decline_finish(uuid) to authenticated;
