-- 장소 풀: 등록해둔 장소를 이벤트에서 재사용. lat/lng는 Geocoding 결과(nullable)
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

alter table public.events
  add column place_id uuid references public.places(id) on delete set null;

-- 기존 이벤트의 distinct (location, address)를 풀로 백필하고 연결
insert into public.places (name, address)
select distinct location, address
from public.events
where coalesce(location, '') <> '' or coalesce(address, '') <> '';

update public.events e
set place_id = p.id
from public.places p
where p.name = e.location
  and p.address = e.address
  and (coalesce(e.location, '') <> '' or coalesce(e.address, '') <> '');

alter table public.places enable row level security;
create policy "places: read all"  on public.places for select using (auth.uid() is not null);
create policy "places: admin all" on public.places for all using (public.is_admin()) with check (public.is_admin());
