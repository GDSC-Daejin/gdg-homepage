-- 어드민 부트스트랩: admin_emails에 등록된 이메일은 가입 시 자동으로 admin 역할
create table public.admin_emails (
  email text primary key
);

alter table public.admin_emails enable row level security;
-- 정책 없음: definer 함수(handle_new_user)에서만 조회, 클라이언트 접근 차단

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
      ) then 'admin'
      else 'applicant'
    end
  );
  return new;
end $$;
