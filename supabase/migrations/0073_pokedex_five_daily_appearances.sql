alter table public.pokemon_appearances
  drop constraint pokemon_appearances_appearance_order_check,
  add constraint pokemon_appearances_appearance_order_check check (appearance_order between 1 and 5);

alter table public.pokemon_catalog
  add column activity_period text not null default 'day' check (activity_period in ('day', 'night'));

update public.pokemon_catalog
set activity_period = 'night'
where pokedex_no in (19, 20, 23, 24, 37, 38, 39, 40, 41, 42, 48, 49, 50, 51, 52, 53, 56, 57, 74, 75, 76, 88, 89, 92, 93, 94, 95, 96, 97, 109, 110, 111, 112, 143);
