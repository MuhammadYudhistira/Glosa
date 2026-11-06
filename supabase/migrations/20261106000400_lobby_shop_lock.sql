-- buy_lobby_item locked the profile with FOR UPDATE, which conflicts with the
-- FOR KEY SHARE an insert into coin_awards takes for its foreign key: a
-- concurrent lobby_state awarding the same member could deadlock. FOR NO KEY
-- UPDATE still serialises purchases but lets the key share through.

-- Buys an item and places it in its slot. The member's profile row is
-- locked (for no key update, so the FK check of a concurrent coin_awards
-- insert, which takes for key share, does not deadlock with it), so two purchases at once cannot both spend the same coins: the
-- second waits and then sees the first.
create or replace function public.buy_lobby_item(p_item text)
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
  perform 1 from public.profiles p where p.id = v_user_id for no key update;
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

revoke execute on function public.buy_lobby_item(text) from public, anon;
grant execute on function public.buy_lobby_item(text) to authenticated;
