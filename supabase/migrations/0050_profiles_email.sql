-- 가입 이메일을 profiles에 미러링한다.
-- 이메일은 auth.users에만 있어서 읽으려면 service role이 필요했다. 미러를 두면 어드민 화면이
-- 일반 RLS로 읽고(본인+관리자), 꼬북봇 슬랙 매칭도 auth.users 조회 없이 된다.
-- unique 제약은 걸지 않는다 — 여기는 사본이고 진실 원천은 auth.users다.

-- SQL Editor에 직접 붙여 넣는 운영 흐름이라 두 번 실행돼도 안전하게 둔다
alter table public.profiles add column if not exists email text;

-- 1) 기존 회원 백필
update public.profiles p
  set email = u.email
  from auth.users u
  where u.id = p.id and p.email is distinct from u.email;

-- 2) 신규 가입 시 함께 채운다 (0040 버전에 email만 추가)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  v_is_admin := exists (select 1 from admin_emails where lower(email) = lower(new.email));
  insert into public.profiles (id, name, email, role, approved_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    case when v_is_admin then 'team_member' else 'member' end,
    case when v_is_admin then now() else null end
  );
  return new;
end $$;

-- 3) 이메일이 바뀌면 미러도 따라간다 — 없으면 사본이 조용히 낡는다
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row when (new.email is distinct from old.email)
  execute function public.sync_profile_email();

-- 4) 본인이 못 바꾸게 둔다 — update grant를 주지 않는다(profiles의 다른 컬럼과 달리).
notify pgrst, 'reload schema';
