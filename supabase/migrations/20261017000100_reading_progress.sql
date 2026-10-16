-- Reading positions (spec §4, §10): one row per member and book. Members read
-- their own rows; every write goes through save_progress, where the newest
-- position wins.
create table public.reading_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  cfi text not null check (char_length(cfi) between 1 and 2000),
  percentage numeric(5, 2) not null check (percentage between 0 and 100),
  updated_at timestamptz not null,
  primary key (user_id, book_id)
);

create index reading_progress_book_id_idx on public.reading_progress (book_id);

alter table public.reading_progress enable row level security;

create policy reading_progress_select_own on public.reading_progress
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.reading_progress from anon, authenticated;
grant select on table public.reading_progress to authenticated;

-- Saves the member's position in one of their ready books unless a newer one is
-- already stored ("newest wins", by the reading device's clock). A timestamp
-- from the future is clamped to now(), so a device with a fast clock cannot
-- freeze the position. Returns whether the position was stored.
create function public.save_progress(
  p_book_id uuid,
  p_cfi text,
  p_percentage numeric,
  p_updated_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_at timestamptz := least(p_updated_at, now());
  v_rows integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.books
    where id = p_book_id and user_id = v_user_id and status = 'ready'
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  insert into public.reading_progress as rp (user_id, book_id, cfi, percentage, updated_at)
  values (v_user_id, p_book_id, p_cfi, p_percentage, v_updated_at)
  on conflict (user_id, book_id) do update
    set cfi = excluded.cfi,
        percentage = excluded.percentage,
        updated_at = excluded.updated_at
    where rp.updated_at < excluded.updated_at;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.save_progress(uuid, text, numeric, timestamptz)
  from public, anon;
grant execute on function public.save_progress(uuid, text, numeric, timestamptz)
  to authenticated;
