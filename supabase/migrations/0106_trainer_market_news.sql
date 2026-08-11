create table public.trainer_market_news (
  id uuid primary key default gen_random_uuid(),
  market_date date not null references public.trainer_markets(market_date) on delete cascade,
  symbol text not null references public.trainer_market_symbols(symbol),
  headline text not null check (char_length(headline) between 4 and 60),
  body text not null check (char_length(body) between 30 and 300),
  sentiment smallint not null check (sentiment between -2 and 2),
  publish_at timestamptz not null,
  posting_at timestamptz,
  posted_at timestamptz,
  message_ts text,
  unique (market_date, symbol)
);

create index trainer_market_news_due_idx on public.trainer_market_news (market_date, publish_at) where posted_at is null;

alter table public.trainer_market_news enable row level security;

update public.trainer_market_symbols set name_ko = '금빛시티 백화점' where symbol = 'CELADON';
update public.bots set description = '게임코너, 포켓몬 주식, 프렌들리숍으로 포인트와 몬스터볼을 연결해요.' where slug = 'trainer_market';

create or replace function public.trainer_open_market()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_created boolean := false;
  v_rows int;
begin
  insert into trainer_markets (market_date, morning_news)
    values (v_today, '포켓기어 속보: 여섯 포켓몬 기업이 오늘의 소식을 준비하고 있어요!')
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

  update trainer_market_prices p
    set close_price = greatest(10, round(p.open_price * (1 + greatest(s.min_change, least(s.max_change, coalesce(n.sentiment, 0) * ceil(greatest(abs(s.min_change), abs(s.max_change)) / 3.0)::int + floor(random() * 3 - 1)::int)) / 100.0))::int)
    from trainer_market_symbols s
    left join trainer_market_news n on n.market_date = p.market_date and n.symbol = p.symbol
    where p.market_date = v_today and s.symbol = p.symbol;

  update trainer_markets set status = 'closed', closed_at = now(), evening_news = '포켓몬 주식 저녁 특보: 오늘의 결과가 확정됐어요. 내일 시가는 오늘 종가에서 이어집니다.' where market_date = v_today;

  for v_pick in select pick.*, price.open_price, price.close_price from trainer_market_picks pick join trainer_market_prices price on price.market_date = pick.market_date and price.symbol = pick.symbol where pick.market_date = v_today and pick.settled_amount is null loop
    perform pg_advisory_xact_lock(hashtext(v_pick.user_id::text));
    v_close := round(v_pick.quantity * 100 * ((v_pick.close_price - v_pick.open_price)::numeric / v_pick.open_price))::int + v_pick.quantity * 10;
    v_settlement := v_pick.stake + v_close;
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
