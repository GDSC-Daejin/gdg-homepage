-- 이벤트 종료 일시(nullable) + 주소 컬럼 추가
alter table public.events add column ends_at timestamptz;
alter table public.events add column address text not null default '';
