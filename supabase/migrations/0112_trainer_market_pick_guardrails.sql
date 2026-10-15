-- 응원권 선택은 버튼 상태와 무관하게 DB에서만 확정한다.

create or replace function public.trainer_pick_stock(p_slack_user text, p_symbol text, p_quantity int, p_interaction_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_user uuid;
  v_balance int;
  v_market trainer_markets%rowtype;
  v_name text;
  v_price int;
  v_stake int;
  v_pick trainer_market_picks%rowtype;
begin
  if coalesce(p_slack_user, '') = '' or coalesce(p_symbol, '') = '' or p_quantity is null or p_quantity not between 1 and 3 or coalesce(p_interaction_id, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;

  -- 장마감과 같은 순서로 잠가 교착 상태를 피한다.
  select * into v_market from trainer_markets where market_date = v_today for update;
  perform pg_advisory_xact_lock(hashtext(v_user::text));

  select * into v_pick from trainer_market_picks where interaction_id = p_interaction_id;
  if found then
    if v_pick.user_id <> v_user or v_pick.symbol <> p_symbol or v_pick.quantity <> p_quantity then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
    select name_ko into v_name from trainer_market_symbols where symbol = v_pick.symbol;
    return jsonb_build_object('ok', true, 'replayed', true, 'name', v_name, 'quantity', v_pick.quantity, 'stake', v_pick.stake, 'balance', v_balance);
  end if;

  if not exists (select 1 from trainer_point_logs where user_id = v_user and reason = 'signup') then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  if v_market.market_date is null or v_market.status <> 'open' or (now() at time zone 'Asia/Seoul')::time < time '09:00' or (now() at time zone 'Asia/Seoul')::time >= time '22:00' then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;

  select name_ko into v_name from trainer_market_symbols where symbol = p_symbol;
  if v_name is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select open_price into v_price from trainer_market_prices where market_date = v_today and symbol = p_symbol;
  if v_price is null then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;

  if exists (select 1 from trainer_market_picks where user_id = v_user and market_date = v_today and symbol = p_symbol) then return jsonb_build_object('ok', false, 'reason', 'duplicate'); end if;
  if (select count(*) from trainer_market_picks where user_id = v_user and market_date = v_today) >= 3 then return jsonb_build_object('ok', false, 'reason', 'company_limit'); end if;
  if coalesce((select sum(quantity) from trainer_market_picks where user_id = v_user and market_date = v_today), 0) + p_quantity > 5 then return jsonb_build_object('ok', false, 'reason', 'ticket_limit'); end if;

  v_stake := p_quantity * v_price;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  if v_balance < v_stake then return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance); end if;

  insert into trainer_market_picks (user_id, market_date, symbol, quantity, stake, interaction_id)
    values (v_user, v_today, p_symbol, p_quantity, v_stake, p_interaction_id);
  insert into trainer_point_logs (user_id, amount, reason) values (v_user, -v_stake, 'stock_pick');
  return jsonb_build_object('ok', true, 'name', v_name, 'quantity', p_quantity, 'stake', v_stake, 'balance', v_balance - v_stake);
end $$;
