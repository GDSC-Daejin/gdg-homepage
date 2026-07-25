-- 어드민이 회원의 슬랙 계정을 연결/해제한다.
-- profiles 쓰기는 봉인돼 있다(0001_init.sql:88-91 — self update 정책 + 컬럼 화이트리스트).
-- slack_user_id는 화이트리스트에 없고 남의 행도 못 고치므로, 관례대로 security definer RPC로 우회한다.

create or replace function public.admin_set_slack_link(p_user uuid, p_slack text)
returns void language plpgsql security definer set search_path = public as $$
declare v_slack text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_user is null then raise exception 'INVALID_INPUT'; end if;

  -- 드롭다운 미선택은 빈 문자열로 오므로 해제로 본다
  v_slack := nullif(btrim(coalesce(p_slack, '')), '');

  if v_slack is not null and exists (
    select 1 from profiles where slack_user_id = v_slack and id <> p_user
  ) then
    raise exception 'SLACK_ALREADY_LINKED';
  end if;

  update profiles set slack_user_id = v_slack where id = p_user;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

revoke execute on function public.admin_set_slack_link(uuid, text) from public, anon;
grant execute on function public.admin_set_slack_link(uuid, text) to authenticated;
