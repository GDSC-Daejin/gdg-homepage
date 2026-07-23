-- 슬랙봇 on/off 스위치판: 봇마다 독립적으로 켜고 끈다
-- pg_cron 스케줄은 건드리지 않는다. 스케줄은 계속 돌되 꺼진 봇은 일을 하지 않는다.
-- (unschedule/schedule 방식은 재생성 실패 시 조용히 영영 꺼지는 위험이 있다)

create table public.bots (
  slug text primary key,
  name text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.bots (slug, name) values ('squirtle', '꼬북봇');

alter table public.bots enable row level security;

create policy "bots: admin read"
  on public.bots for select using (public.is_admin());
