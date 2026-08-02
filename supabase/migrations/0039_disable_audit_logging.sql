-- 기존 감사 로그 데이터는 보존하고, 모든 기존 RPC의 새 기록만 중단한다.
create or replace function public.log_audit(p_action text, p_target text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  return;
end $$;
