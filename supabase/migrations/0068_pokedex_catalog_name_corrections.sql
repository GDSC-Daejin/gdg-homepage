update public.pokemon_catalog
set name_ko = case pokedex_no
  when 13 then '뿔충이'
  when 17 then '피죤'
  when 18 then '피죤투'
  when 41 then '주뱃'
  when 42 then '골뱃'
  when 78 then '날쌩마'
  when 88 then '질퍽이'
  when 89 then '질뻐기'
  when 105 then '텅구리'
  when 111 then '뿔카노'
end
where pokedex_no in (13, 17, 18, 41, 42, 78, 88, 89, 105, 111);
