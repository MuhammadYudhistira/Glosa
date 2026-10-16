-- Members no longer delete book rows themselves: a direct delete would free the
-- quota while the Storage objects stay readable. Deletion goes through the
-- server, which removes the objects first (plan 1B, decision 7).
drop policy books_delete_own on public.books;
revoke delete on table public.books from authenticated;

-- Keep the bucket private with its intended limits, even if it pre-existed.
update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['application/epub+zip', 'image/webp', 'image/jpeg']
where id = 'books';
