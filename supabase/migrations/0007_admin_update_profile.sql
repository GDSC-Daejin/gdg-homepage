-- 관리자가 회원의 프로필 상세 정보(이름/학번/전공/전화번호/관심분야)를 수정할 수 있는 RPC
create or replace function public.admin_update_profile(
  p_user uuid,
  p_name text,
  p_student_no text,
  p_major text,
  p_phone text,
  p_interests text[]
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update profiles set
    name = p_name,
    student_no = p_student_no,
    major = p_major,
    phone = p_phone,
    interests = p_interests
  where id = p_user;
end $$;

grant execute on function public.admin_update_profile(uuid, text, text, text, text, text[])
to authenticated;
