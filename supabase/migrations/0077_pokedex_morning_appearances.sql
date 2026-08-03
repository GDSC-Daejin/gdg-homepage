alter table public.pokemon_catalog
  drop constraint pokemon_catalog_activity_period_check,
  add constraint pokemon_catalog_activity_period_check check (activity_period in ('morning', 'day', 'night'));

update public.pokemon_catalog
set activity_period = 'morning'
where pokedex_no in (10, 16, 17, 18, 21, 22, 83, 84, 85);
