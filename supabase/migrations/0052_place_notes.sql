-- 장소 운영 메모: 오시는 길·주차·출입·와이파이 등 네이버 지도에 없는 정보를 운영자가 직접 적는다
alter table public.places add column notes text not null default '';
