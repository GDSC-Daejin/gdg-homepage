create table public.monster_ball_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null check (quantity in (1, 5, 10)),
  spent int not null check (spent in (100, 450, 900)),
  redeemed_on date not null,
  request_id uuid not null unique,
  created_at timestamptz not null default now()
);

create index monster_ball_redemptions_user_day_idx
  on public.monster_ball_redemptions (user_id, redeemed_on);

alter table public.monster_ball_redemptions enable row level security;

create policy "monster ball redemptions: own or admin"
  on public.monster_ball_redemptions for select
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.purchase_monster_balls(
  p_quantity int,
  p_request_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_price int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_balance int;
  v_daily_quantity int;
  v_balls int;
  v_redemption monster_ball_redemptions%rowtype;
begin
  if v_user is null or p_quantity not in (1, 5, 10) or p_request_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  v_price := case p_quantity when 1 then 100 when 5 then 450 when 10 then 900 end;
  perform pg_advisory_xact_lock(hashtext(v_user::text));

  select * into v_redemption
    from monster_ball_redemptions
   where request_id = p_request_id and user_id = v_user;
  if found then
    select coalesce(sum(amount), 0)::int into v_balance from point_logs where user_id = v_user;
    select quantity into v_balls from pokemon_ball_inventory where user_id = v_user and ball_slug = 'poke_ball';
    return jsonb_build_object('ok', true, 'replayed', true, 'quantity', v_redemption.quantity,
      'spent', v_redemption.spent, 'balance', v_balance, 'balls', coalesce(v_balls, 0));
  end if;

  if not exists (
    select 1 from profiles where id = v_user and status = 'active' and role <> 'applicant'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  select coalesce(sum(quantity), 0)::int into v_daily_quantity
    from monster_ball_redemptions
   where user_id = v_user and redeemed_on = v_today;
  if v_daily_quantity + p_quantity > 10 then
    return jsonb_build_object('ok', false, 'reason', 'daily_limit', 'remaining', 10 - v_daily_quantity);
  end if;

  select coalesce(sum(amount), 0)::int into v_balance from point_logs where user_id = v_user;
  if v_balance < v_price then
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance);
  end if;

  insert into monster_ball_redemptions (user_id, quantity, spent, redeemed_on, request_id)
  values (v_user, p_quantity, v_price, v_today, p_request_id);
  insert into point_logs (user_id, amount, reason)
  values (v_user, -v_price, '몬스터볼 교환');
  insert into pokemon_ball_inventory (user_id, ball_slug, quantity)
  values (v_user, 'poke_ball', p_quantity)
  on conflict (user_id, ball_slug) do update
    set quantity = pokemon_ball_inventory.quantity + excluded.quantity
  returning quantity into v_balls;

  return jsonb_build_object('ok', true, 'quantity', p_quantity, 'spent', v_price,
    'balance', v_balance - v_price, 'balls', v_balls, 'daily_purchased', v_daily_quantity + p_quantity);
end;
$$;

revoke execute on function public.purchase_monster_balls(int, uuid) from public, anon;
grant execute on function public.purchase_monster_balls(int, uuid) to authenticated;
