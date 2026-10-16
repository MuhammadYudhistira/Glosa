-- Marks an upload ready only while its reservation still counts toward the
-- quota (pending and younger than an hour, by the database clock). Returns
-- whether a row was updated.
create function public.mark_book_ready(p_user_id uuid, p_book_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.books
    set status = 'ready'
    where id = p_book_id
      and user_id = p_user_id
      and status = 'pending'
      and created_at > now() - interval '1 hour'
    returning 1
  )
  select exists (select 1 from updated)
$$;

revoke execute on function public.mark_book_ready(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_book_ready(uuid, uuid) to service_role;
