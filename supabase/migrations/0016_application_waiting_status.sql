-- 지원서 상태 4단계화: 심사 대기(waiting) 추가
-- 흐름: waiting(심사 대기·신규 지원 기본값) → pending(심사 중) → accepted/rejected

alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('waiting', 'pending', 'accepted', 'rejected'));

alter table public.applications
  alter column status set default 'waiting';

-- 상태 변경 RPC: 4개 상태 자유 전환 (기존 admin_review_application 대체)
-- 익명 지원(applicant_id null) 허용, 합격 시에만 로그인 지원자 회원 승격
create or replace function public.admin_set_application_status(p_application uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_applicant uuid;
  v_decided boolean := p_status in ('accepted', 'rejected');
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('waiting', 'pending', 'accepted', 'rejected') then
    raise exception 'INVALID_INPUT';
  end if;
  update applications
    set status = p_status,
        reviewed_by = case when v_decided then auth.uid() else null end,
        reviewed_at = case when v_decided then now() else null end
    where id = p_application
    returning applicant_id into v_applicant;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status = 'accepted' and v_applicant is not null then
    update profiles set role = 'member' where id = v_applicant and role = 'applicant';
  end if;
  perform public.log_audit('review_application', p_application::text, jsonb_build_object('status', p_status));
end $$;

revoke execute on function public.admin_set_application_status(uuid, text) from public, anon;
grant execute on function public.admin_set_application_status(uuid, text) to authenticated;
