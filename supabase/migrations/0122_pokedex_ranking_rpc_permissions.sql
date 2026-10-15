-- 랭킹전 내부 보조 함수는 PostgREST에서 직접 호출할 수 없어야 한다.
revoke execute on function public.pokedex_rank_kst_today() from public, anon, authenticated;
revoke execute on function public.pokedex_rank_type_multiplier(text, text) from public, anon, authenticated;
revoke execute on function public.pokedex_rank_close_season(uuid) from public, anon, authenticated;
revoke execute on function public.pokedex_rank_current_season() from public, anon, authenticated;
revoke execute on function public.pokedex_rank_preset_team(uuid, uuid, text, smallint) from public, anon, authenticated;
revoke execute on function public.pokedex_rank_allocate_for(uuid, date, uuid) from public, anon, authenticated;

-- 일일 상대 배정은 인증된 사용자 세션이 아닌 보호된 cron의 service_role만 실행한다.
grant execute on function public.pokedex_rank_refresh_daily() to service_role;
