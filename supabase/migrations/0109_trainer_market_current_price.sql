-- 응원권은 당일 시가로 매수하고, 장마감 종가 기준으로 정산한다.

alter table public.trainer_market_picks drop constraint if exists trainer_market_picks_stake_check;
alter table public.trainer_market_picks add constraint trainer_market_picks_stake_check check (stake >= quantity * 10);

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
  if p_quantity not between 1 and 3 or coalesce(p_interaction_id, '') = '' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if not exists (select 1 from trainer_point_logs where user_id = v_user and reason = 'signup') then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  select * into v_market from trainer_markets where market_date = v_today for update;
  if not found or v_market.status <> 'open' or (now() at time zone 'Asia/Seoul')::time < time '09:00' or (now() at time zone 'Asia/Seoul')::time >= time '22:00' then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  select name_ko into v_name from trainer_market_symbols where symbol = p_symbol;
  if v_name is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select open_price into v_price from trainer_market_prices where market_date = v_today and symbol = p_symbol;
  if v_price is null then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  select * into v_pick from trainer_market_picks where interaction_id = p_interaction_id;
  if found then
    select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
    select name_ko into v_name from trainer_market_symbols where symbol = v_pick.symbol;
    return jsonb_build_object('ok', true, 'replayed', true, 'name', v_name, 'quantity', v_pick.quantity, 'stake', v_pick.stake, 'balance', v_balance);
  end if;
  if exists (select 1 from trainer_market_picks where user_id = v_user and market_date = v_today and symbol = p_symbol) then return jsonb_build_object('ok', false, 'reason', 'duplicate'); end if;
  if (select count(*) from trainer_market_picks where user_id = v_user and market_date = v_today) >= 3 then return jsonb_build_object('ok', false, 'reason', 'company_limit'); end if;
  if coalesce((select sum(quantity) from trainer_market_picks where user_id = v_user and market_date = v_today), 0) + p_quantity > 5 then return jsonb_build_object('ok', false, 'reason', 'ticket_limit'); end if;
  v_stake := p_quantity * v_price;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  if v_balance < v_stake then return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance); end if;
  insert into trainer_market_picks (user_id, market_date, symbol, quantity, stake, interaction_id) values (v_user, v_today, p_symbol, p_quantity, v_stake, p_interaction_id);
  insert into trainer_point_logs (user_id, amount, reason) values (v_user, -v_stake, 'stock_pick');
  return jsonb_build_object('ok', true, 'name', v_name, 'quantity', p_quantity, 'stake', v_stake, 'balance', v_balance - v_stake);
end $$;

create or replace function public.trainer_close_market()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_market trainer_markets%rowtype;
  v_pick record;
  v_change int;
  v_settlement int;
  v_briefing jsonb;
begin
  select * into v_market from trainer_markets where market_date = v_today for update;
  if not found then return jsonb_build_object('closed', false, 'reason', 'not_opened'); end if;
  if v_market.status = 'closed' then return jsonb_build_object('closed', false, 'reason', 'already_closed', 'briefing', v_market.close_briefing); end if;

  update trainer_market_prices p
    set close_price = greatest(10, round(p.open_price * (1 + greatest(s.min_change, least(s.max_change, coalesce(n.sentiment, 0) * ceil(greatest(abs(s.min_change), abs(s.max_change)) / 3.0)::int + floor(random() * 3 - 1)::int)) / 100.0))::int)
    from trainer_market_symbols s
    left join trainer_market_news n on n.market_date = p.market_date and n.symbol = p.symbol
    where p.market_date = v_today and s.symbol = p.symbol;

  update trainer_markets set status = 'closed', closed_at = now(), evening_news = '포켓몬 주식 저녁 특보: 오늘의 결과가 확정됐어요. 내일 시가는 오늘 종가에서 이어집니다.' where market_date = v_today;

  for v_pick in select pick.*, price.open_price, price.close_price from trainer_market_picks pick join trainer_market_prices price on price.market_date = pick.market_date and price.symbol = pick.symbol where pick.market_date = v_today and pick.settled_amount is null loop
    perform pg_advisory_xact_lock(hashtext(v_pick.user_id::text));
    v_change := round(v_pick.stake * ((v_pick.close_price - v_pick.open_price)::numeric / v_pick.open_price))::int + v_pick.quantity * 10;
    v_settlement := v_pick.stake + v_change;
    update trainer_market_picks set settled_amount = v_settlement where id = v_pick.id;
    insert into trainer_point_logs (user_id, amount, reason) values (v_pick.user_id, v_settlement, 'stock_settlement');
  end loop;

  select jsonb_build_object(
    'gainer', (select jsonb_build_object('name', s.name_ko, 'change', round((p.close_price - p.open_price)::numeric * 100 / p.open_price)::int) from trainer_market_prices p join trainer_market_symbols s on s.symbol = p.symbol where p.market_date = v_today order by abs(p.close_price - p.open_price)::numeric / p.open_price desc, p.symbol limit 1),
    'profits', coalesce((select jsonb_agg(jsonb_build_object('slack_user_id', slack_user_id, 'amount', amount, 'symbols', symbols) order by amount desc) from (select pr.slack_user_id, sum(pick.settled_amount - pick.stake)::int as amount, string_agg(s.name_ko, ', ' order by s.name_ko) as symbols from trainer_market_picks pick join profiles pr on pr.id = pick.user_id join trainer_market_symbols s on s.symbol = pick.symbol where pick.market_date = v_today group by pr.slack_user_id having sum(pick.settled_amount - pick.stake) > 0 order by amount desc limit 3) profit_rows), '[]'::jsonb),
    'losses', coalesce((select jsonb_agg(jsonb_build_object('slack_user_id', slack_user_id, 'amount', amount, 'symbols', symbols) order by amount asc) from (select pr.slack_user_id, sum(pick.settled_amount - pick.stake)::int as amount, string_agg(s.name_ko, ', ' order by s.name_ko) as symbols from trainer_market_picks pick join profiles pr on pr.id = pick.user_id join trainer_market_symbols s on s.symbol = pick.symbol where pick.market_date = v_today group by pr.slack_user_id having sum(pick.settled_amount - pick.stake) < 0 order by amount asc limit 3) loss_rows), '[]'::jsonb)
  ) into v_briefing;
  update trainer_markets set close_briefing = v_briefing where market_date = v_today;
  return jsonb_build_object('closed', true, 'briefing', v_briefing);
end $$;
