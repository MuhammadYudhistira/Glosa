-- Member profiles: one row per auth user, created by a trigger on signup.

create sequence public.member_no_seq start 1;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  member_no bigint not null unique default nextval('public.member_no_seq'),
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  storage_limit_bytes bigint not null default 104857600,
  reader_settings jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter sequence public.member_no_seq owned by public.profiles.member_no;

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Members may only touch these columns; plan, quota and member_no stay server-only.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, username, avatar_url, reader_settings, onboarded_at)
  on table public.profiles to authenticated;

create function public.normalize_username(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(lower(coalesce(raw, '')), '[^a-z0-9_]', '', 'g'), 20)
$$;

create function public.unique_username(base text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  stem text := public.normalize_username(base);
  candidate text;
  suffix int := 0;
begin
  if char_length(stem) < 3 then
    stem := 'pembaca';
  end if;
  candidate := stem;
  while exists (select 1 from public.profiles where username = candidate) loop
    suffix := suffix + 1;
    candidate := left(stem, 20 - char_length(suffix::text)) || suffix::text;
  end loop;
  return candidate;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  local_part text := split_part(coalesce(new.email, ''), '@', 1);
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    public.unique_username(coalesce(nullif(meta ->> 'username', ''), local_part)),
    left(coalesce(
      nullif(meta ->> 'display_name', ''),
      nullif(meta ->> 'full_name', ''),
      nullif(meta ->> 'name', ''),
      nullif(local_part, ''),
      'Pembaca'
    ), 60),
    nullif(meta ->> 'avatar_url', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where username = candidate)
$$;

-- "Pengunjung hari ini": a bare count, never names (spec §6).
create function public.visitors_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from auth.users
  where last_sign_in_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')
$$;

revoke execute on function public.normalize_username(text) from public, anon, authenticated;
revoke execute on function public.unique_username(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.username_available(text) from public;
revoke execute on function public.visitors_today() from public;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.visitors_today() to anon, authenticated;
