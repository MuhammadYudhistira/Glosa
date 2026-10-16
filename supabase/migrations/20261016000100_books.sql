-- Books on a member's shelf (spec §4, §5). Clients never insert: rows are
-- created by reserve_book_upload, which only the server (service_role) may run.

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '' check (char_length(author) <= 300),
  description text check (char_length(description) <= 2000),
  language text check (char_length(language) <= 35),
  file_path text not null,
  cover_path text,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  genre text check (genre in (
    'fiksi_sastra', 'fantasi_petualangan', 'misteri_thriller', 'anak_remaja',
    'sains_teknologi', 'sejarah_budaya', 'bisnis_pengembangan_diri', 'lainnya'
  )),
  genre_source text check (genre_source in ('auto', 'user')),
  subjects text[] not null default '{}' check (cardinality(subjects) <= 30),
  work_id uuid,
  created_at timestamptz not null default now(),
  last_opened_at timestamptz,
  unique (user_id, sha256),
  check ((genre is null) = (genre_source is null))
);

create index books_user_status_idx on public.books (user_id, status);

alter table public.books enable row level security;

create policy books_select_own on public.books
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy books_update_own on public.books
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy books_delete_own on public.books
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Members may read and delete their books and change only these columns.
revoke all on table public.books from anon, authenticated;
grant select, delete on table public.books to authenticated;
grant update (genre, genre_source, last_opened_at) on table public.books to authenticated;

-- Reserves room for an upload: locks the member's profile row so concurrent
-- requests queue up, rejects duplicates, checks the computed quota and inserts
-- a pending row. Returns the Storage paths to sign.
create function public.reserve_book_upload(
  p_user_id uuid,
  p_book_id uuid,
  p_sha256 text,
  p_epub_bytes bigint,
  p_title text,
  p_author text,
  p_subjects text[],
  p_cover_bytes bigint default 0,
  p_cover_type text default null,
  p_description text default null,
  p_language text default null,
  p_genre text default null,
  p_genre_source text default null
)
returns table (epub_path text, cover_object_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit bigint;
  v_used bigint;
  v_cover_bytes bigint := coalesce(p_cover_bytes, 0);
  v_epub_path text := p_user_id::text || '/' || p_book_id::text || '.epub';
  v_cover_path text := case p_cover_type
    when 'image/webp' then p_user_id::text || '/' || p_book_id::text || '-cover.webp'
    when 'image/jpeg' then p_user_id::text || '/' || p_book_id::text || '-cover.jpg'
  end;
begin
  if p_epub_bytes <= 0 or p_epub_bytes > 52428800 then
    raise exception 'too_large' using errcode = 'P0001';
  end if;
  if (v_cover_path is null) <> (v_cover_bytes = 0)
    or v_cover_bytes < 0 or v_cover_bytes > 2097152 then
    raise exception 'invalid_cover' using errcode = 'P0001';
  end if;

  select pr.storage_limit_bytes into v_limit
  from public.profiles pr
  where pr.id = p_user_id
  for update;
  if not found then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.books b
    where b.user_id = p_user_id and b.sha256 = p_sha256
  ) then
    raise exception 'duplicate' using errcode = 'P0001';
  end if;

  -- Usage is computed, never stored. Pending rows older than an hour are
  -- abandoned uploads and no longer count (the server removes them).
  select coalesce(sum(b.size_bytes), 0) into v_used
  from public.books b
  where b.user_id = p_user_id
    and (b.status = 'ready' or b.created_at > now() - interval '1 hour');

  if v_used + p_epub_bytes + v_cover_bytes > v_limit then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;

  insert into public.books (
    id, user_id, title, author, description, language, file_path, cover_path,
    size_bytes, sha256, genre, genre_source, subjects
  ) values (
    p_book_id, p_user_id, p_title, coalesce(p_author, ''), p_description,
    p_language, v_epub_path, v_cover_path, p_epub_bytes + v_cover_bytes,
    p_sha256, p_genre, p_genre_source, coalesce(p_subjects, '{}')
  );

  return query select v_epub_path, v_cover_path;
end;
$$;

revoke execute on function public.reserve_book_upload(
  uuid, uuid, text, bigint, text, text, text[], bigint, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.reserve_book_upload(
  uuid, uuid, text, bigint, text, text, text[], bigint, text, text, text, text, text
) to service_role;

-- Private bucket for EPUB files and covers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'books', 'books', false, 52428800,
  array['application/epub+zip', 'image/webp', 'image/jpeg']
)
on conflict (id) do nothing;

-- Members read only their own folder. No insert/update/delete policies:
-- uploads use signed upload URLs and removals go through the server.
create policy books_objects_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
