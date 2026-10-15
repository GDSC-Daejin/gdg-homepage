-- 하루 사건은 한 번만, 종목 기사는 서로 다른 사업 결과만 기록한다.

create table public.trainer_market_story_pool (
  market_date date primary key,
  title text not null check (char_length(title) between 4 and 60),
  summary text not null check (char_length(summary) between 30 and 220),
  causal_chain text not null check (char_length(causal_chain) between 10 and 160),
  closing_note text not null check (char_length(closing_note) between 10 and 160)
);

alter table public.trainer_market_story_pool enable row level security;

alter table public.trainer_market_news_pool
  add column angle text,
  add column predecessors text[];
alter table public.trainer_market_news
  add column angle text,
  add column predecessors text[];
alter table public.trainer_markets
  add column story_title text,
  add column story_summary text,
  add column story_causal_chain text,
  add column story_closing_note text;

alter table public.trainer_market_news_pool drop constraint trainer_market_news_pool_body_check;
alter table public.trainer_market_news_pool add constraint trainer_market_news_pool_body_check check (char_length(body) between 10 and 300);
alter table public.trainer_market_news drop constraint trainer_market_news_body_check;
alter table public.trainer_market_news add constraint trainer_market_news_body_check check (char_length(body) between 10 and 300);

with stories as (
  select market_date, btrim(substring(body from '^((?:[^.]*\.){2})')) as summary
  from trainer_market_news_pool
  where publish_order = 1
)
insert into trainer_market_story_pool (market_date, title, summary, causal_chain, closing_note)
select
  market_date,
  left(split_part(summary, '.', 1), 60),
  summary,
  'OAK → SILPH → BALL·ROCKET → CENTER·CELADON',
  '오늘의 현장 변화가 장마감 결과에 반영됐어요.'
from stories;

update trainer_market_news_pool n
set
  body = btrim(replace(replace(n.body, s.summary || ' ', ''), ' 현장 운영 계획에 반영됐어요.', '')),
  angle = case n.symbol
    when 'OAK' then 'research'
    when 'SILPH' then 'technology'
    when 'BALL' then 'manufacturing'
    when 'ROCKET' then 'logistics'
    when 'CENTER' then 'care'
    when 'CELADON' then 'retail'
  end,
  predecessors = case n.symbol
    when 'OAK' then array['story']
    when 'SILPH' then array['OAK']
    when 'BALL' then array['SILPH']
    when 'ROCKET' then array['SILPH']
    when 'CENTER' then array['ROCKET']
    when 'CELADON' then array['CENTER']
  end
from trainer_market_story_pool s
where s.market_date = n.market_date;

alter table public.trainer_market_news_pool
  alter column angle set not null,
  alter column predecessors set not null,
  add constraint trainer_market_news_pool_angle_check check (angle in ('research', 'technology', 'manufacturing', 'logistics', 'care', 'retail')),
  add constraint trainer_market_news_pool_predecessors_check check (cardinality(predecessors) > 0);

update trainer_market_news n
set angle = p.angle, predecessors = p.predecessors, body = p.body
from trainer_market_news_pool p
where p.market_date = n.market_date
  and p.symbol = n.symbol
  and n.posted_at is null;

update trainer_markets m
set
  story_title = s.title,
  story_summary = s.summary,
  story_causal_chain = s.causal_chain,
  story_closing_note = s.closing_note
from trainer_market_story_pool s
where s.market_date = m.market_date;

create or replace function public.trainer_open_market()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_story trainer_market_story_pool%rowtype;
  v_created boolean := false;
  v_rows int;
begin
  select * into v_story from trainer_market_story_pool where market_date = v_today;
  if not found then return jsonb_build_object('created', false, 'reason', 'missing_story'); end if;
  if (select count(*) from trainer_market_news_pool where market_date = v_today) <> 6 then
    return jsonb_build_object('created', false, 'reason', 'missing_story');
  end if;

  insert into trainer_markets (market_date, morning_news, story_title, story_summary, story_causal_chain, story_closing_note)
    values (v_today, '포켓기어 속보: 오늘의 관동 시장이 열렸어요.', v_story.title, v_story.summary, v_story.causal_chain, v_story.closing_note)
    on conflict do nothing;
  get diagnostics v_rows = row_count;
  v_created := v_rows > 0;

  if v_created then
    insert into trainer_market_prices (market_date, symbol, open_price)
      select v_today, s.symbol, coalesce((select p.close_price from trainer_market_prices p where p.symbol = s.symbol and p.close_price is not null order by p.market_date desc limit 1), s.initial_price)
      from trainer_market_symbols s;
    insert into trainer_market_news (market_date, symbol, headline, body, sentiment, angle, predecessors, publish_at)
      select v_today, symbol, headline, body, sentiment, angle, predecessors, (v_today + time '10:30') at time zone 'Asia/Seoul'
      from trainer_market_news_pool
      where market_date = v_today;
  end if;

  return jsonb_build_object('created', v_created, 'market_date', v_today);
end $$;
