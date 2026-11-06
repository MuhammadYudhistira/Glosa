-- The lobby shop (spec 3C §5). Coins are never stored: the balance is
-- worked out from reading_time, coin_awards and coin_grants, minus the
-- purchases, so it cannot drift from what was read.

-- The catalogue; the server takes prices from here, never from the client.
-- Same rows as src/lib/shop/catalog.ts (tests/db/shop.test.ts).
create table public.lobby_items (
  id text primary key,
  slot text not null
    check (slot in ('rug', 'lamp', 'seat', 'wall', 'pet', 'ceiling')),
  price integer not null check (price > 0)
);

insert into public.lobby_items (id, slot, price) values
  ('rug_woven', 'rug', 60),
  ('rug_round', 'rug', 120),
  ('rug_pattern', 'rug', 300),
  ('lamp_floor', 'lamp', 80),
  ('lamp_arc', 'lamp', 150),
  ('lamp_lantern', 'lamp', 250),
  ('seat_beanbag', 'seat', 100),
  ('seat_armchair', 'seat', 200),
  ('seat_sofa', 'seat', 400),
  ('wall_map', 'wall', 120),
  ('wall_painting', 'wall', 200),
  ('wall_clock', 'wall', 300),
  ('pet_cat', 'pet', 250),
  ('pet_bird', 'pet', 300),
  ('pet_aquarium', 'pet', 400),
  ('ceiling_lights', 'ceiling', 150),
  ('ceiling_books', 'ceiling', 350),
  ('ceiling_globe', 'ceiling', 600);

alter table public.lobby_items enable row level security;
create policy lobby_items_select on public.lobby_items
  for select to authenticated
  using (true);
revoke all on table public.lobby_items from anon, authenticated;
grant select on table public.lobby_items to authenticated;

-- +50 for a finished book read an hour (spec 3C §3.1). Written once and
-- never deleted; book_id has no foreign key, like reading_time, so the
-- bonus stays after the book is deleted.
create table public.coin_awards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null,
  coins integer not null check (coins > 0),
  awarded_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

-- Coins from outside reading, e.g. bought in Tahap 5. Empty in 3C.
create table public.coin_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  coins integer not null check (coins > 0),
  reason text not null,
  created_at timestamptz not null default now()
);
create index coin_grants_user_id on public.coin_grants (user_id);

-- Bought once, kept for good, with the price paid then.
create table public.lobby_purchases (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.lobby_items (id),
  price integer not null check (price > 0),
  bought_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- At most one item per slot, and only an item the member owns.
create table public.lobby_placements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  slot text not null,
  item_id text not null,
  primary key (user_id, slot),
  foreign key (user_id, item_id)
    references public.lobby_purchases (user_id, item_id) on delete cascade
);

alter table public.coin_awards enable row level security;
alter table public.coin_grants enable row level security;
alter table public.lobby_purchases enable row level security;
alter table public.lobby_placements enable row level security;

create policy coin_awards_select_own on public.coin_awards
  for select to authenticated using (user_id = (select auth.uid()));
create policy coin_grants_select_own on public.coin_grants
  for select to authenticated using (user_id = (select auth.uid()));
create policy lobby_purchases_select_own on public.lobby_purchases
  for select to authenticated using (user_id = (select auth.uid()));
create policy lobby_placements_select_own on public.lobby_placements
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.coin_awards from anon, authenticated;
revoke all on table public.coin_grants from anon, authenticated;
revoke all on table public.lobby_purchases from anon, authenticated;
revoke all on table public.lobby_placements from anon, authenticated;
grant select on table public.coin_awards to authenticated;
grant select on table public.coin_grants to authenticated;
grant select on table public.lobby_purchases to authenticated;
grant select on table public.lobby_placements to authenticated;

-- Internal: the bonus for every finished book read an hour that has none.
-- Run before every balance, so a book finished before its last minutes
-- arrived still earns it once they do.
create function public.award_book_coins(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.coin_awards (user_id, book_id, coins)
  select b.user_id, b.id, 50
  from public.books b
  where b.user_id = p_user_id
    and b.finished_at is not null
    and (
      select coalesce(sum(rt.seconds), 0)
      from public.reading_time rt
      where rt.user_id = p_user_id and rt.book_id = b.id
    ) >= 3600
  on conflict (user_id, book_id) do nothing
$$;

-- Internal: coins earned (whole minutes per day, at most 240, plus bonuses
-- and grants) and coins spent.
create function public.coin_totals(p_user_id uuid)
returns table (earned integer, spent integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      (select coalesce(sum(least(d.seconds / 60, 240)), 0)
        from (
          select sum(rt.seconds) as seconds
          from public.reading_time rt
          where rt.user_id = p_user_id
          group by rt.day
        ) d)
      + (select coalesce(sum(a.coins), 0)
        from public.coin_awards a where a.user_id = p_user_id)
      + (select coalesce(sum(g.coins), 0)
        from public.coin_grants g where g.user_id = p_user_id)
    )::integer,
    (select coalesce(sum(p.price), 0)
      from public.lobby_purchases p where p.user_id = p_user_id)::integer
$$;

-- The balance, the items owned and the items placed, in one answer.
create function public.lobby_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_earned integer;
  v_spent integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  perform public.award_book_coins(v_user_id);
  select t.earned, t.spent into v_earned, v_spent
  from public.coin_totals(v_user_id) t;
  return jsonb_build_object(
    'earned', v_earned,
    'spent', v_spent,
    'balance', v_earned - v_spent,
    'owned', coalesce(
      (select jsonb_agg(p.item_id order by p.bought_at, p.item_id)
        from public.lobby_purchases p where p.user_id = v_user_id),
      '[]'::jsonb),
    'placed', coalesce(
      (select jsonb_object_agg(l.slot, l.item_id)
        from public.lobby_placements l where l.user_id = v_user_id),
      '{}'::jsonb)
  );
end;
$$;

-- Buys an item and places it in its slot. The member's profile row is
-- locked, so two purchases at once cannot both spend the same coins: the
-- second waits and then sees the first.
create function public.buy_lobby_item(p_item text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_slot text;
  v_price integer;
  v_earned integer;
  v_spent integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  select i.slot, i.price into v_slot, v_price
  from public.lobby_items i where i.id = p_item;
  if not found then
    return 'not_found';
  end if;
  perform 1 from public.profiles p where p.id = v_user_id for update;
  if exists (
    select 1 from public.lobby_purchases p
    where p.user_id = v_user_id and p.item_id = p_item
  ) then
    return 'owned';
  end if;
  perform public.award_book_coins(v_user_id);
  select t.earned, t.spent into v_earned, v_spent
  from public.coin_totals(v_user_id) t;
  if v_earned - v_spent < v_price then
    return 'not_enough';
  end if;
  insert into public.lobby_purchases (user_id, item_id, price)
  values (v_user_id, p_item, v_price);
  insert into public.lobby_placements as l (user_id, slot, item_id)
  values (v_user_id, v_slot, p_item)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;
  return 'ok';
end;
$$;

-- Places an owned item in its slot; a null item takes the slot's item off.
create function public.place_lobby_item(p_slot text, p_item text)
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
  if p_slot is null or not exists (
    select 1 from public.lobby_items i where i.slot = p_slot
  ) then
    return 'not_found';
  end if;
  if p_item is null then
    delete from public.lobby_placements l
    where l.user_id = v_user_id and l.slot = p_slot;
    return 'ok';
  end if;
  if not exists (
    select 1 from public.lobby_items i where i.id = p_item and i.slot = p_slot
  ) then
    return 'not_found';
  end if;
  if not exists (
    select 1 from public.lobby_purchases p
    where p.user_id = v_user_id and p.item_id = p_item
  ) then
    return 'not_owned';
  end if;
  insert into public.lobby_placements as l (user_id, slot, item_id)
  values (v_user_id, p_slot, p_item)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;
  return 'ok';
end;
$$;

revoke execute on function public.award_book_coins(uuid)
  from public, anon, authenticated;
revoke execute on function public.coin_totals(uuid)
  from public, anon, authenticated;
revoke execute on function public.lobby_state() from public, anon;
grant execute on function public.lobby_state() to authenticated;
revoke execute on function public.buy_lobby_item(text) from public, anon;
grant execute on function public.buy_lobby_item(text) to authenticated;
revoke execute on function public.place_lobby_item(text, text)
  from public, anon;
grant execute on function public.place_lobby_item(text, text)
  to authenticated;
