alter table public.pokemon_catalog
  add column rarity text not null default 'common' check (rarity in ('common', 'uncommon', 'rare', 'very_rare', 'legendary')),
  add column spawn_weight int not null default 100 check (spawn_weight > 0);

update public.pokemon_catalog
set rarity = case pokedex_no
  when 1 then 'uncommon' when 2 then 'rare' when 3 then 'very_rare'
  when 4 then 'uncommon' when 5 then 'rare' when 6 then 'very_rare'
  when 7 then 'uncommon' when 8 then 'rare' when 9 then 'very_rare'
  when 11 then 'uncommon' when 12 then 'rare'
  when 14 then 'uncommon' when 15 then 'rare'
  when 17 then 'uncommon' when 18 then 'rare'
  when 20 then 'uncommon' when 22 then 'uncommon' when 24 then 'uncommon'
  when 25 then 'uncommon' when 26 then 'rare'
  when 28 then 'uncommon' when 30 then 'uncommon' when 31 then 'rare'
  when 33 then 'uncommon' when 34 then 'rare'
  when 35 then 'uncommon' when 36 then 'rare'
  when 37 then 'uncommon' when 38 then 'rare' when 40 then 'uncommon'
  when 42 then 'uncommon' when 44 then 'uncommon' when 45 then 'rare'
  when 47 then 'uncommon' when 49 then 'uncommon' when 51 then 'uncommon'
  when 53 then 'uncommon' when 55 then 'uncommon' when 57 then 'uncommon'
  when 58 then 'uncommon' when 59 then 'rare' when 61 then 'uncommon' when 62 then 'rare'
  when 63 then 'uncommon' when 64 then 'rare' when 65 then 'very_rare'
  when 67 then 'uncommon' when 68 then 'rare' when 70 then 'uncommon' when 71 then 'rare'
  when 72 then 'uncommon' when 75 then 'uncommon' when 76 then 'rare'
  when 77 then 'uncommon' when 78 then 'rare' when 80 then 'uncommon'
  when 82 then 'uncommon' when 83 then 'rare' when 85 then 'uncommon'
  when 87 then 'uncommon' when 89 then 'uncommon' when 91 then 'uncommon'
  when 92 then 'uncommon' when 93 then 'rare' when 94 then 'very_rare' when 95 then 'rare'
  when 97 then 'uncommon' when 99 then 'uncommon' when 101 then 'uncommon' when 103 then 'uncommon'
  when 104 then 'uncommon' when 105 then 'rare'
  when 106 then 'rare' when 107 then 'rare' when 108 then 'rare'
  when 110 then 'uncommon' when 111 then 'uncommon' when 112 then 'rare'
  when 113 then 'very_rare' when 114 then 'rare' when 115 then 'very_rare'
  when 116 then 'uncommon' when 117 then 'rare' when 118 then 'uncommon' when 119 then 'uncommon' when 121 then 'uncommon'
  when 122 then 'rare' when 123 then 'very_rare' when 124 then 'rare' when 125 then 'rare' when 126 then 'rare'
  when 127 then 'very_rare' when 128 then 'very_rare' when 130 then 'rare' when 131 then 'very_rare'
  when 132 then 'rare' when 133 then 'rare' when 134 then 'very_rare' when 135 then 'very_rare' when 136 then 'very_rare'
  when 137 then 'very_rare' when 138 then 'rare' when 139 then 'very_rare' when 141 then 'very_rare'
  when 142 then 'very_rare' when 143 then 'very_rare'
  when 144 then 'legendary' when 145 then 'legendary' when 146 then 'legendary'
  when 147 then 'uncommon' when 148 then 'rare' when 149 then 'very_rare'
  when 150 then 'legendary' when 151 then 'legendary'
  else 'common'
end;

update public.pokemon_catalog
set spawn_weight = case rarity
  when 'common' then 100
  when 'uncommon' then 55
  when 'rare' then 25
  when 'very_rare' then 12
  when 'legendary' then 8
end,
catch_rate = case rarity
  when 'common' then 0.70
  when 'uncommon' then 0.60
  when 'rare' then 0.48
  when 'very_rare' then 0.36
  when 'legendary' then 0.28
end;
