-- 트레이너 마켓봇: 기존 서비스 포인트와 분리된 TP 경제

create table public.trainer_point_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount <> 0),
  reason text not null check (reason in ('signup', 'checkin', 'game_corner', 'stock_pick', 'stock_settlement', 'ball_exchange')),
  created_at timestamptz not null default now()
);

create index trainer_point_logs_user_created_idx on public.trainer_point_logs (user_id, created_at desc);

create table public.trainer_checkins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_on date not null,
  primary key (user_id, checked_on)
);

create table public.trainer_game_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bet_on date not null,
  stake int not null check (stake in (10, 50, 100)),
  guess text not null check (guess in ('odd', 'even')),
  roll smallint not null check (roll between 1 and 6),
  payout int not null check (payout >= 0),
  interaction_id text not null unique,
  shared_at timestamptz,
  created_at timestamptz not null default now()
);

create index trainer_game_bets_user_day_idx on public.trainer_game_bets (user_id, bet_on);

create table public.trainer_ball_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity int not null check (quantity between 1 and 3),
  spent int not null check (spent = quantity * 200),
  interaction_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.trainer_market_symbols (
  symbol text primary key check (symbol in ('SILPH', 'BALL', 'CENTER', 'CELADON', 'OAK', 'ROCKET')),
  name_ko text not null,
  emoji text not null,
  initial_price int not null check (initial_price >= 10),
  min_change int not null,
  max_change int not null check (min_change <= max_change)
);

insert into public.trainer_market_symbols (symbol, name_ko, emoji, initial_price, min_change, max_change) values
  ('SILPH', '실프 주식회사', '🧪', 150, -5, 5),
  ('BALL', '몬스터볼 팩토리', '🏭', 100, -3, 3),
  ('CENTER', '포켓몬센터', '❤️', 130, -2, 2),
  ('CELADON', '무지개백화점', '🏬', 120, -5, 5),
  ('OAK', '오박사연구소', '🔬', 200, -8, 8),
  ('ROCKET', '로켓단 홀딩스', '🚀', 80, -15, 15);

create table public.trainer_markets (
  market_date date primary key,
  status text not null default 'open' check (status in ('open', 'closed')),
  morning_news text not null,
  evening_news text,
  close_briefing jsonb,
  open_message_ts text,
  close_message_ts text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.trainer_market_prices (
  market_date date not null references public.trainer_markets(market_date) on delete cascade,
  symbol text not null references public.trainer_market_symbols(symbol),
  open_price int not null check (open_price >= 10),
  close_price int check (close_price >= 10),
  primary key (market_date, symbol)
);

create table public.trainer_market_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_date date not null references public.trainer_markets(market_date) on delete restrict,
  symbol text not null references public.trainer_market_symbols(symbol),
  quantity int not null check (quantity between 1 and 3),
  stake int not null check (stake = quantity * 100),
  settled_amount int check (settled_amount >= 0),
  interaction_id text not null unique,
  created_at timestamptz not null default now(),
  unique (user_id, market_date, symbol)
);

create index trainer_market_picks_user_day_idx on public.trainer_market_picks (user_id, market_date);

alter table public.trainer_point_logs enable row level security;
alter table public.trainer_checkins enable row level security;
alter table public.trainer_game_bets enable row level security;
alter table public.trainer_ball_redemptions enable row level security;
alter table public.trainer_market_symbols enable row level security;
alter table public.trainer_markets enable row level security;
alter table public.trainer_market_prices enable row level security;
alter table public.trainer_market_picks enable row level security;

create or replace function public.trainer_open_market()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_created boolean := false;
  v_rows int;
begin
  insert into trainer_markets (market_date, morning_news)
    values (v_today, '포켓기어 속보: 관동의 여섯 기업이 오늘 탐험가들의 응원을 기다리고 있어요!')
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_created := v_rows > 0;

  if v_created then
    insert into trainer_market_prices (market_date, symbol, open_price)
      select v_today, s.symbol, coalesce((select p.close_price from trainer_market_prices p where p.symbol = s.symbol and p.close_price is not null order by p.market_date desc limit 1), s.initial_price)
      from trainer_market_symbols s;
  end if;

  return jsonb_build_object('created', v_created, 'market_date', v_today);
end $$;

create or replace function public.trainer_start(p_slack_user text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_balance int;
  v_started boolean := false;
begin
  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if not exists (select 1 from trainer_point_logs where user_id = v_user and reason = 'signup') then
    insert into trainer_point_logs (user_id, amount, reason) values (v_user, 500, 'signup');
    v_started := true;
  end if;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  return jsonb_build_object('ok', true, 'started', v_started, 'balance', v_balance);
end $$;

create or replace function public.trainer_checkin(p_slack_user text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_user uuid;
  v_balance int;
  v_claimed boolean := false;
  v_rows int;
begin
  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if not exists (select 1 from trainer_point_logs where user_id = v_user and reason = 'signup') then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  insert into trainer_checkins (user_id, checked_on) values (v_user, v_today) on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_claimed := v_rows > 0;
  if v_claimed then insert into trainer_point_logs (user_id, amount, reason) values (v_user, 50, 'checkin'); end if;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  return jsonb_build_object('ok', true, 'claimed', v_claimed, 'balance', v_balance);
end $$;

create or replace function public.trainer_game_bet(p_slack_user text, p_stake int, p_guess text, p_interaction_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_user uuid;
  v_balance int;
  v_bet trainer_game_bets%rowtype;
  v_roll smallint;
  v_payout int;
begin
  if p_stake not in (10, 50, 100) or p_guess not in ('odd', 'even') or coalesce(p_interaction_id, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if not exists (select 1 from trainer_point_logs where user_id = v_user and reason = 'signup') then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  select * into v_bet from trainer_game_bets where interaction_id = p_interaction_id;
  if found then
    select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
    return jsonb_build_object('ok', true, 'replayed', true, 'id', v_bet.id, 'stake', v_bet.stake, 'guess', v_bet.guess, 'roll', v_bet.roll, 'payout', v_bet.payout, 'balance', v_balance);
  end if;
  if (select count(*) from trainer_game_bets where user_id = v_user and bet_on = v_today) >= 3 then return jsonb_build_object('ok', false, 'reason', 'daily_count'); end if;
  if coalesce((select sum(stake) from trainer_game_bets where user_id = v_user and bet_on = v_today), 0) + p_stake > 100 then return jsonb_build_object('ok', false, 'reason', 'daily_stake'); end if;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  if v_balance < p_stake then return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance); end if;
  v_roll := floor(random() * 6 + 1)::smallint;
  v_payout := case when (p_guess = 'odd' and v_roll % 2 = 1) or (p_guess = 'even' and v_roll % 2 = 0) then floor(p_stake * 1.8)::int else 0 end;
  insert into trainer_game_bets (user_id, bet_on, stake, guess, roll, payout, interaction_id) values (v_user, v_today, p_stake, p_guess, v_roll, v_payout, p_interaction_id) returning * into v_bet;
  insert into trainer_point_logs (user_id, amount, reason) values (v_user, v_payout - p_stake, 'game_corner');
  return jsonb_build_object('ok', true, 'id', v_bet.id, 'stake', p_stake, 'guess', p_guess, 'roll', v_roll, 'payout', v_payout, 'balance', v_balance + v_payout - p_stake);
end $$;

create or replace function public.trainer_share_game_bet(p_slack_user text, p_bet_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_bet trainer_game_bets%rowtype;
begin
  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
  select * into v_bet from trainer_game_bets where id = p_bet_id and user_id = v_user for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'missing'); end if;
  if v_bet.shared_at is not null then return jsonb_build_object('ok', true, 'already_shared', true, 'stake', v_bet.stake, 'guess', v_bet.guess, 'roll', v_bet.roll, 'payout', v_bet.payout); end if;
  update trainer_game_bets set shared_at = now() where id = p_bet_id;
  return jsonb_build_object('ok', true, 'already_shared', false, 'stake', v_bet.stake, 'guess', v_bet.guess, 'roll', v_bet.roll, 'payout', v_bet.payout);
end $$;

create or replace function public.trainer_buy_balls(p_slack_user text, p_quantity int, p_interaction_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_balance int;
  v_quantity int;
  v_redemption trainer_ball_redemptions%rowtype;
begin
  if p_quantity not between 1 and 3 or coalesce(p_interaction_id, '') = '' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if not exists (select 1 from trainer_point_logs where user_id = v_user and reason = 'signup') then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  select * into v_redemption from trainer_ball_redemptions where interaction_id = p_interaction_id;
  if found then
    select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
    select quantity into v_quantity from pokemon_ball_inventory where user_id = v_user and ball_slug = 'poke_ball';
    return jsonb_build_object('ok', true, 'replayed', true, 'quantity', v_redemption.quantity, 'balls', v_quantity, 'balance', v_balance);
  end if;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  if v_balance < p_quantity * 200 then return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance); end if;
  insert into trainer_ball_redemptions (user_id, quantity, spent, interaction_id) values (v_user, p_quantity, p_quantity * 200, p_interaction_id);
  insert into trainer_point_logs (user_id, amount, reason) values (v_user, -p_quantity * 200, 'ball_exchange');
  insert into pokemon_ball_inventory (user_id, ball_slug, quantity) values (v_user, 'poke_ball', p_quantity)
    on conflict (user_id, ball_slug) do update set quantity = pokemon_ball_inventory.quantity + excluded.quantity
    returning quantity into v_quantity;
  return jsonb_build_object('ok', true, 'quantity', p_quantity, 'balls', v_quantity, 'balance', v_balance - p_quantity * 200);
end $$;

create or replace function public.trainer_pick_stock(p_slack_user text, p_symbol text, p_quantity int, p_interaction_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_user uuid;
  v_balance int;
  v_market trainer_markets%rowtype;
  v_name text;
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
  select * into v_pick from trainer_market_picks where interaction_id = p_interaction_id;
  if found then
    select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
    select name_ko into v_name from trainer_market_symbols where symbol = v_pick.symbol;
    return jsonb_build_object('ok', true, 'replayed', true, 'name', v_name, 'quantity', v_pick.quantity, 'balance', v_balance);
  end if;
  if exists (select 1 from trainer_market_picks where user_id = v_user and market_date = v_today and symbol = p_symbol) then return jsonb_build_object('ok', false, 'reason', 'duplicate'); end if;
  if (select count(*) from trainer_market_picks where user_id = v_user and market_date = v_today) >= 3 then return jsonb_build_object('ok', false, 'reason', 'company_limit'); end if;
  if coalesce((select sum(quantity) from trainer_market_picks where user_id = v_user and market_date = v_today), 0) + p_quantity > 5 then return jsonb_build_object('ok', false, 'reason', 'ticket_limit'); end if;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  if v_balance < p_quantity * 100 then return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance', v_balance); end if;
  insert into trainer_market_picks (user_id, market_date, symbol, quantity, stake, interaction_id) values (v_user, v_today, p_symbol, p_quantity, p_quantity * 100, p_interaction_id);
  insert into trainer_point_logs (user_id, amount, reason) values (v_user, -p_quantity * 100, 'stock_pick');
  return jsonb_build_object('ok', true, 'name', v_name, 'quantity', p_quantity, 'balance', v_balance - p_quantity * 100);
end $$;

create or replace function public.trainer_close_market()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_market trainer_markets%rowtype;
  v_pick record;
  v_close int;
  v_settlement int;
  v_briefing jsonb;
begin
  select * into v_market from trainer_markets where market_date = v_today for update;
  if not found then return jsonb_build_object('closed', false, 'reason', 'not_opened'); end if;
  if v_market.status = 'closed' then return jsonb_build_object('closed', false, 'reason', 'already_closed', 'briefing', v_market.close_briefing); end if;

  update trainer_market_prices p set close_price = greatest(10, round(p.open_price * (1 + (floor(random() * (s.max_change - s.min_change + 1) + s.min_change) / 100.0)))::int)
    from trainer_market_symbols s where p.market_date = v_today and s.symbol = p.symbol;

  update trainer_markets set status = 'closed', closed_at = now(), evening_news = '관동 저녁 특보: 오늘의 응원 결과가 확정됐어요. 내일 시가는 오늘 종가에서 이어집니다.' where market_date = v_today;

  for v_pick in select pick.*, price.open_price, price.close_price from trainer_market_picks pick join trainer_market_prices price on price.market_date = pick.market_date and price.symbol = pick.symbol where pick.market_date = v_today and pick.settled_amount is null loop
    perform pg_advisory_xact_lock(hashtext(v_pick.user_id::text));
    v_close := round(v_pick.quantity * 100 * ((v_pick.close_price - v_pick.open_price)::numeric / v_pick.open_price))::int + v_pick.quantity * 10;
    v_settlement := v_pick.stake + v_close;
    update trainer_market_picks set settled_amount = v_settlement where id = v_pick.id;
    insert into trainer_point_logs (user_id, amount, reason) values (v_pick.user_id, v_settlement, 'stock_settlement');
  end loop;

  select jsonb_build_object(
    'gainer', (select jsonb_build_object('symbol', p.symbol, 'change', round((p.close_price - p.open_price)::numeric * 100 / p.open_price)::int) from trainer_market_prices p where p.market_date = v_today order by abs(p.close_price - p.open_price)::numeric / p.open_price desc, p.symbol limit 1),
    'profits', coalesce((select jsonb_agg(jsonb_build_object('slack_user_id', slack_user_id, 'amount', amount, 'symbols', symbols) order by amount desc) from (select pr.slack_user_id, sum(pick.settled_amount - pick.stake)::int as amount, string_agg(pick.symbol, ', ' order by pick.symbol) as symbols from trainer_market_picks pick join profiles pr on pr.id = pick.user_id where pick.market_date = v_today group by pr.slack_user_id having sum(pick.settled_amount - pick.stake) > 0 order by amount desc limit 3) profit_rows), '[]'::jsonb),
    'losses', coalesce((select jsonb_agg(jsonb_build_object('slack_user_id', slack_user_id, 'amount', amount, 'symbols', symbols) order by amount asc) from (select pr.slack_user_id, sum(pick.settled_amount - pick.stake)::int as amount, string_agg(pick.symbol, ', ' order by pick.symbol) as symbols from trainer_market_picks pick join profiles pr on pr.id = pick.user_id where pick.market_date = v_today group by pr.slack_user_id having sum(pick.settled_amount - pick.stake) < 0 order by amount asc limit 3) loss_rows), '[]'::jsonb)
  ) into v_briefing;
  update trainer_markets set close_briefing = v_briefing where market_date = v_today;
  return jsonb_build_object('closed', true, 'briefing', v_briefing);
end $$;

create or replace function public.trainer_card(p_slack_user text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_balance int;
begin
  select id into v_user from profiles where slack_user_id = p_slack_user and status = 'active' and role <> 'applicant';
  if v_user is null then return jsonb_build_object('ok', false, 'reason', 'unlinked'); end if;
  if not exists (select 1 from trainer_point_logs where user_id = v_user and reason = 'signup') then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  select coalesce(sum(amount), 0)::int into v_balance from trainer_point_logs where user_id = v_user;
  return jsonb_build_object('ok', true, 'balance', v_balance, 'checked_in', exists(select 1 from trainer_checkins where user_id = v_user and checked_on = v_today), 'bets', (select count(*) from trainer_game_bets where user_id = v_user and bet_on = v_today), 'bet_stake', coalesce((select sum(stake) from trainer_game_bets where user_id = v_user and bet_on = v_today), 0));
end $$;

create or replace function public.trainer_stock_trend(p_symbol text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'ok', exists(select 1 from trainer_market_symbols where symbol = upper(p_symbol)),
    'symbol', upper(p_symbol),
    'name', (select name_ko from trainer_market_symbols where symbol = upper(p_symbol)),
    'prices', coalesce((select jsonb_agg(jsonb_build_object('close', close_price, 'open', open_price) order by market_date) from (select market_date, open_price, close_price from trainer_market_prices where symbol = upper(p_symbol) and close_price is not null order by market_date desc limit 7) recent), '[]'::jsonb)
  )
$$;

insert into public.bots (slug, name, description) values ('trainer_market', '트레이너 마켓봇', '게임코너, 관동 증권거래소, 프렌들리숍으로 TP와 몬스터볼을 연결해요.') on conflict (slug) do nothing;

revoke execute on function public.trainer_open_market() from public, anon, authenticated;
revoke execute on function public.trainer_start(text) from public, anon, authenticated;
revoke execute on function public.trainer_checkin(text) from public, anon, authenticated;
revoke execute on function public.trainer_game_bet(text, int, text, text) from public, anon, authenticated;
revoke execute on function public.trainer_share_game_bet(text, uuid) from public, anon, authenticated;
revoke execute on function public.trainer_buy_balls(text, int, text) from public, anon, authenticated;
revoke execute on function public.trainer_pick_stock(text, text, int, text) from public, anon, authenticated;
revoke execute on function public.trainer_close_market() from public, anon, authenticated;
revoke execute on function public.trainer_card(text) from public, anon, authenticated;
revoke execute on function public.trainer_stock_trend(text) from public, anon, authenticated;

-- 교환 볼은 무료 일일 보충으로 줄어들지 않는다.
create or replace function public.pokedex_grant_daily_balls()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_granted int;
begin
  with granted as (
    insert into pokemon_ball_grants (user_id, ball_slug, granted_on)
    select id, 'poke_ball', v_today from profiles where status = 'active' and role <> 'applicant'
    on conflict do nothing returning user_id
  ), updated as (
    insert into pokemon_ball_inventory (user_id, ball_slug, quantity)
    select user_id, 'poke_ball', 3 from granted
    on conflict (user_id, ball_slug) do update set quantity = greatest(pokemon_ball_inventory.quantity, 3)
    returning user_id
  ) select count(*) into v_granted from updated;
  return v_granted;
end $$;

revoke execute on function public.pokedex_grant_daily_balls() from public, anon, authenticated;
