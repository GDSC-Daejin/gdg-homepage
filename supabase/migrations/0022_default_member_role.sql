-- 구글 로그인 신규 가입자는 기본적으로 정회원(member)
-- 지원(applicant)은 익명 공개지원(/apply, applicant_id=null)으로만 발생하므로
-- 로그인 가입의 기본 role을 applicant → member 로 변경
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when exists (
        select 1 from admin_emails where lower(email) = lower(new.email)
      ) then 'team_member'
      else 'member'
    end
  );
  return new;
end $$;
