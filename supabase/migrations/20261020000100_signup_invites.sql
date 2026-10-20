-- Closed trial (spec 1E §4): only invited emails may create an account, by
-- email or Google alike, until app_settings.signups_open is true. Supabase
-- Auth calls before_user_created as its "Before User Created" hook.

-- Emails are stored lowercase and trimmed (plan 1E, decision 1).
create table public.signup_invites (
  email text primary key check (email <> '' and email = lower(btrim(email))),
  note text,
  created_at timestamptz not null default now()
);

-- A single row: its id can only be true.
create table public.app_settings (
  id boolean primary key default true check (id),
  signups_open boolean not null default false
);
insert into public.app_settings (id) values (true);

-- RLS on and no policies: the owner manages both from the SQL editor.
alter table public.signup_invites enable row level security;
alter table public.app_settings enable row level security;
revoke all on table public.signup_invites from anon, authenticated;
revoke all on table public.app_settings from anon, authenticated;

create function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if coalesce((select s.signups_open from public.app_settings s where s.id), false)
    or exists (select 1 from public.signup_invites i where i.email = v_email)
  then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Glosa sedang dalam uji coba tertutup. Pendaftaran baru dibuka untuk umum segera.'
  ));
end;
$$;

-- Supabase Auth runs the hook as supabase_auth_admin; service_role may call it
-- so integration tests can check it directly (plan 1E, decision 2).
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin, service_role;
grant usage on schema public to supabase_auth_admin;
