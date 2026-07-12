-- 동아리 활동에 쓰는 영어 닉네임 (선택 입력)
alter table public.profiles
  add column nickname text not null default '';

grant update (nickname) on public.profiles to authenticated;

-- 관리자 프로필 수정 RPC에 닉네임 추가 (기존 시그니처 교체)
drop function if exists public.admin_update_profile(uuid, text, text, text, text, text[]);

create or replace function public.admin_update_profile(
  p_user uuid,
  p_name text,
  p_nickname text,
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
    nickname = p_nickname,
    student_no = p_student_no,
    major = p_major,
    phone = p_phone,
    interests = p_interests
  where id = p_user;
end $$;

grant execute on function public.admin_update_profile(uuid, text, text, text, text, text, text[])
to authenticated;
