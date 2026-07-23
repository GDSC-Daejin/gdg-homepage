-- 회원 완전 삭제 RPC (0042의 FK set null 전환이 선행 조건)
-- auth.users 삭제 → profiles cascade → 연결 데이터 정리.
-- 서비스 롤 키 없이 다른 admin_* RPC와 동일한 방식으로 동작.

create or replace function public.admin_delete_member(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_user = auth.uid() then raise exception 'SELF_DELETE'; end if;
  if exists (select 1 from profiles where id = p_user and role = 'organizer') then
    raise exception 'FORBIDDEN';
  end if;
  if not exists (select 1 from profiles where id = p_user) then
    raise exception 'NOT_FOUND';
  end if;

  delete from auth.users where id = p_user;
end $$;

revoke execute on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;

-- 권한 자가검증: 함수 소유자(postgres)가 auth.users 를 지울 수 있는지 지금 확인한다.
-- 랜덤 uuid 라 실제로 지워지는 행은 없지만, DELETE 권한이 없으면 여기서 마이그레이션이 실패한다.
do $$ begin delete from auth.users where id = gen_random_uuid(); end $$;
