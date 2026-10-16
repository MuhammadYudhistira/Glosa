-- Hoarding guards: members read only the files of their ready books, and the
-- number of fresh pending reservations is capped.

drop policy books_objects_select_own on storage.objects;

-- Members read only the files of their ready books: objects without a row, or
-- belonging to a reservation that was never confirmed, are useless to hoard.
create policy books_objects_select_ready on storage.objects
  for select to authenticated
  using (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
      from public.books b
      where b.user_id = (select auth.uid())
        and b.status = 'ready'
        and (b.file_path = storage.objects.name or b.cover_path = storage.objects.name)
    )
  );

create or replace function public.reserve_book_upload(
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

  -- Caps how many unconfirmed reservations a member can hold at once.
  if (
    select count(*) from public.books b
    where b.user_id = p_user_id
      and b.status = 'pending'
      and b.created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'too_many_pending' using errcode = 'P0001';
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
