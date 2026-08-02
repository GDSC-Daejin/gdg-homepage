-- 도감봇: 슬랙 이모지 포획과 개인 포켓몬 도감

create table public.pokemon_catalog (
  id uuid primary key default gen_random_uuid(),
  pokedex_no int not null unique,
  name_ko text not null unique,
  image_path text not null,
  catch_rate numeric not null check (catch_rate > 0 and catch_rate <= 1),
  dwell_minutes int not null check (dwell_minutes in (30, 60, 90)),
  active boolean not null default true
);

create table public.pokemon_ball_types (
  slug text primary key,
  name_ko text not null,
  slack_emoji text not null unique,
  capture_multiplier numeric not null check (capture_multiplier > 0),
  active boolean not null default true
);

create table public.pokemon_ball_inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ball_slug text not null references public.pokemon_ball_types(slug),
  quantity int not null check (quantity >= 0),
  primary key (user_id, ball_slug)
);

create table public.pokemon_ball_grants (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ball_slug text not null references public.pokemon_ball_types(slug),
  granted_on date not null,
  primary key (user_id, ball_slug, granted_on)
);

create table public.pokemon_appearances (
  id uuid primary key default gen_random_uuid(),
  appears_on date not null,
  appearance_order smallint not null check (appearance_order between 1 and 3),
  pokemon_id uuid not null references public.pokemon_catalog(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null default 'scheduled' check (status in ('scheduled', 'posting', 'posted', 'expired')),
  posting_started_at timestamptz,
  message_ts text unique,
  unique (appears_on, appearance_order)
);

create table public.pokemon_throws (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  appearance_id uuid not null references public.pokemon_appearances(id) on delete restrict,
  pokemon_id uuid not null references public.pokemon_catalog(id) on delete restrict,
  ball_slug text not null references public.pokemon_ball_types(slug),
  attempted_on date not null,
  outcome text not null check (outcome in ('caught', 'escaped')),
  created_at timestamptz not null default now(),
  unique (user_id, attempted_on)
);

create index pokemon_appearances_due_idx on public.pokemon_appearances (status, starts_at);
create index pokemon_throws_user_outcome_idx on public.pokemon_throws (user_id, outcome);

alter table public.pokemon_catalog enable row level security;
alter table public.pokemon_ball_types enable row level security;
alter table public.pokemon_ball_inventory enable row level security;
alter table public.pokemon_ball_grants enable row level security;
alter table public.pokemon_appearances enable row level security;
alter table public.pokemon_throws enable row level security;

create policy "pokemon_catalog: member read" on public.pokemon_catalog
  for select to authenticated using (true);
create policy "pokemon_ball_types: member read" on public.pokemon_ball_types
  for select to authenticated using (true);
create policy "pokemon_ball_inventory: own or admin" on public.pokemon_ball_inventory
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "pokemon_ball_grants: admin read" on public.pokemon_ball_grants
  for select to authenticated using (public.is_admin());
create policy "pokemon_appearances: posted read" on public.pokemon_appearances
  for select to authenticated using (status = 'posted' or public.is_admin());
create policy "pokemon_throws: own or admin" on public.pokemon_throws
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

insert into public.pokemon_ball_types (slug, name_ko, slack_emoji, capture_multiplier)
values ('poke_ball', '몬스터볼', 'pokeball', 1.0);

insert into public.pokemon_catalog (pokedex_no, name_ko, image_path, catch_rate, dwell_minutes) values
  (1, '이상해씨', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png', 0.6, 90),
  (2, '이상해풀', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png', 0.4, 60),
  (3, '이상해꽃', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png', 0.2, 30),
  (4, '파이리', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png', 0.6, 90),
  (5, '리자드', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/5.png', 0.4, 60),
  (6, '리자몽', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png', 0.2, 30),
  (7, '꼬부기', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png', 0.6, 90),
  (8, '어니부기', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/8.png', 0.4, 60),
  (9, '거북왕', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png', 0.2, 30),
  (25, '피카츄', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png', 0.6, 90),
  (26, '라이츄', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/26.png', 0.4, 60),
  (39, '푸린', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png', 0.6, 90),
  (52, '나옹', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/52.png', 0.6, 90),
  (54, '고라파덕', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png', 0.6, 90),
  (58, '가디', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/58.png', 0.6, 90),
  (77, '포니타', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/77.png', 0.6, 90),
  (92, '고오스', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/92.png', 0.4, 60),
  (94, '팬텀', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png', 0.2, 30),
  (131, '라프라스', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/131.png', 0.2, 30),
  (133, '이브이', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png', 0.4, 60),
  (134, '샤미드', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/134.png', 0.4, 60),
  (135, '쥬피썬더', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/135.png', 0.4, 60),
  (136, '부스터', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/136.png', 0.4, 60),
  (143, '잠만보', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png', 0.2, 30),
  (147, '미뇽', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/147.png', 0.2, 30);

insert into public.bots (slug, name, description)
values ('pokedex', '도감봇', '하루 세 번 나타나는 야생 포켓몬을 몬스터볼 이모지로 포획해요.')
on conflict (slug) do nothing;

create or replace function public.pokedex_grant_daily_balls()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_granted int;
begin
  with granted as (
    insert into pokemon_ball_grants (user_id, ball_slug, granted_on)
    select id, 'poke_ball', v_today from profiles
      where status = 'active' and role <> 'applicant'
    on conflict do nothing
    returning user_id
  ), updated as (
    insert into pokemon_ball_inventory (user_id, ball_slug, quantity)
    select user_id, 'poke_ball', 1 from granted
    on conflict (user_id, ball_slug) do update
      set quantity = least(3, pokemon_ball_inventory.quantity + 1)
    returning user_id
  )
  select count(*) into v_granted from updated;
  return v_granted;
end $$;

create or replace function public.pokedex_throw_ball(p_slack_user text, p_message_ts text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_user uuid;
  v_appearance pokemon_appearances%rowtype;
  v_pokemon pokemon_catalog%rowtype;
  v_quantity int;
  v_outcome text;
begin
  select id into v_user from profiles where slack_user_id = p_slack_user;
  if v_user is null then return jsonb_build_object('processed', false, 'reason', 'unlinked'); end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text || v_today::text));

  select * into v_appearance from pokemon_appearances where message_ts = p_message_ts;
  if not found then return jsonb_build_object('processed', false, 'reason', 'invalid'); end if;
  select * into v_pokemon from pokemon_catalog where id = v_appearance.pokemon_id;
  if v_appearance.status <> 'posted' or v_appearance.ends_at <= now() then
    return jsonb_build_object('processed', false, 'reason', 'expired', 'pokemon_name', v_pokemon.name_ko);
  end if;
  if exists (select 1 from pokemon_throws where user_id = v_user and attempted_on = v_today) then
    return jsonb_build_object('processed', false, 'reason', 'already_thrown');
  end if;

  select quantity into v_quantity from pokemon_ball_inventory
    where user_id = v_user and ball_slug = 'poke_ball' for update;
  if coalesce(v_quantity, 0) = 0 then return jsonb_build_object('processed', false, 'reason', 'no_ball'); end if;

  update pokemon_ball_inventory set quantity = quantity - 1
    where user_id = v_user and ball_slug = 'poke_ball';
  v_outcome := case when random() < v_pokemon.catch_rate then 'caught' else 'escaped' end;
  insert into pokemon_throws (user_id, appearance_id, pokemon_id, ball_slug, attempted_on, outcome)
    values (v_user, v_appearance.id, v_pokemon.id, 'poke_ball', v_today, v_outcome);
  return jsonb_build_object('processed', true, 'outcome', v_outcome, 'pokemon_name', v_pokemon.name_ko);
end $$;

revoke execute on function public.pokedex_grant_daily_balls() from public, anon, authenticated;
revoke execute on function public.pokedex_throw_ball(text, text) from public, anon, authenticated;
