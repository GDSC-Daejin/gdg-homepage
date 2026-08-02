update public.pokemon_appearances a
set combat_power = floor(random() * (p.cp_max - p.cp_min + 1))::int + p.cp_min
from public.pokemon_catalog p
where a.pokemon_id = p.id
  and a.combat_power is null;
