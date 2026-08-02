-- 합불 통보 이메일 발송 기록용 RPC (기존 audit_logs 재사용, 별도 테이블 없음)

create or replace function public.admin_log_result_email(p_application uuid, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  perform public.log_audit('send_result_email', p_application::text, coalesce(p_detail, '{}'::jsonb));
end $$;

revoke execute on function public.admin_log_result_email(uuid, jsonb) from public, anon;
grant execute on function public.admin_log_result_email(uuid, jsonb) to authenticated;
