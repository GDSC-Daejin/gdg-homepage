-- 공지
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.notices enable row level security;
create policy "notices: read published" on public.notices for select using (auth.uid() is not null and (published or public.is_admin()));
create policy "notices: admin all" on public.notices for all using (public.is_admin()) with check (public.is_admin());

-- 설문
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_id uuid references public.events(id) on delete set null,
  questions jsonb not null default '[]'::jsonb, -- [{id:text, type:'rating'|'text', label:text}]
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,   -- {qid: number|string}
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);
alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;
create policy "surveys: read" on public.surveys for select using (auth.uid() is not null);
create policy "surveys: admin all" on public.surveys for all using (public.is_admin()) with check (public.is_admin());
create policy "responses: own insert" on public.survey_responses for insert
  with check (user_id = auth.uid() and exists (select 1 from public.surveys s where s.id = survey_id and s.is_open));
create policy "responses: own or admin" on public.survey_responses for select using (user_id = auth.uid() or public.is_admin());

-- 문의/건의
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  status text not null default 'pending' check (status in ('pending','answered')),
  answer text,
  answered_by uuid references public.profiles(id),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
create policy "inquiries: own insert" on public.inquiries for insert with check (user_id = auth.uid());
create policy "inquiries: own or admin" on public.inquiries for select using (user_id = auth.uid() or public.is_admin());

-- 포인트/뱃지
create table public.point_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  reason text not null,
  ref_event uuid references public.events(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  icon text not null default '🏅'
);
create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  awarded_by uuid references public.profiles(id),
  awarded_at timestamptz not null default now(),
  unique (badge_id, user_id)
);
alter table public.point_logs enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
create policy "points: own or admin" on public.point_logs for select using (user_id = auth.uid() or public.is_admin());
create policy "badges: read" on public.badges for select using (auth.uid() is not null);
create policy "badges: admin all" on public.badges for all using (public.is_admin()) with check (public.is_admin());
create policy "user_badges: own or admin" on public.user_badges for select using (user_id = auth.uid() or public.is_admin());
-- 쓰기는 트리거/RPC로만

-- 출석 자동 포인트 (+10)
create or replace function public.grant_attendance_points()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into point_logs (user_id, amount, reason, ref_event)
  values (new.user_id, 10, '출석', new.event_id);
  return new;
end $$;
create trigger on_attendance_points after insert on public.attendances
  for each row execute function public.grant_attendance_points();

-- 예산/후원 (admin only)
create table public.budget_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  type text not null check (type in ('income','expense')),
  category text not null,
  amount int not null check (amount > 0),
  memo text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount int not null default 0,
  season text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table public.budget_entries enable row level security;
alter table public.sponsors enable row level security;
create policy "budget: admin only" on public.budget_entries for all using (public.is_admin()) with check (public.is_admin());
create policy "sponsors: admin only" on public.sponsors for all using (public.is_admin()) with check (public.is_admin());

-- 감사 로그
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles(id),
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create policy "audit: admin read" on public.audit_logs for select using (public.is_admin());

create or replace function public.log_audit(p_action text, p_target text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor, action, target, detail) values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
end $$;

-- 기존 admin RPC에 audit 추가 (create or replace, 본문은 0001과 동일 + log_audit 한 줄)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('admin','member','applicant') then raise exception 'INVALID_INPUT'; end if;
  update profiles set role = p_role where id = p_user;
  perform public.log_audit('set_role', p_user::text, jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_set_status(p_user uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active','dormant','withdrawn') then raise exception 'INVALID_INPUT'; end if;
  update profiles set status = p_status where id = p_user;
  perform public.log_audit('set_status', p_user::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_review_application(p_application uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_applicant uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('accepted','rejected') then raise exception 'INVALID_INPUT'; end if;
  update applications set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_application returning applicant_id into v_applicant;
  if v_applicant is null then raise exception 'NOT_FOUND'; end if;
  if p_status = 'accepted' then
    update profiles set role = 'member' where id = v_applicant and role = 'applicant';
  end if;
  perform public.log_audit('review_application', p_application::text, jsonb_build_object('status', p_status));
end $$;

create or replace function public.admin_set_event_code(p_event_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into event_codes (event_id, code) values (p_event_id, v_code)
    on conflict (event_id) do update set code = excluded.code, updated_at = now();
  perform public.log_audit('issue_code', p_event_id::text, '{}'::jsonb);
  return v_code;
end $$;

-- 신규 admin RPC
create or replace function public.admin_answer_inquiry(p_inquiry uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update inquiries set status = 'answered', answer = p_answer, answered_by = auth.uid(), answered_at = now()
    where id = p_inquiry;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.log_audit('answer_inquiry', p_inquiry::text, '{}'::jsonb);
end $$;

create or replace function public.admin_grant_points(p_user uuid, p_amount int, p_reason text, p_event uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_amount = 0 or p_reason = '' then raise exception 'INVALID_INPUT'; end if;
  insert into point_logs (user_id, amount, reason, ref_event, created_by)
    values (p_user, p_amount, p_reason, p_event, auth.uid());
  perform public.log_audit('grant_points', p_user::text, jsonb_build_object('amount', p_amount, 'reason', p_reason));
end $$;

create or replace function public.admin_award_badge(p_user uuid, p_badge uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into user_badges (badge_id, user_id, awarded_by) values (p_badge, p_user, auth.uid());
  perform public.log_audit('award_badge', p_user::text, jsonb_build_object('badge', p_badge));
end $$;

-- EXECUTE 봉인 (Global Constraint)
revoke execute on function public.log_audit(text, text, jsonb) from public, anon;
revoke execute on function public.grant_attendance_points() from public, anon;
revoke execute on function public.admin_answer_inquiry(uuid, text) from public, anon;
revoke execute on function public.admin_grant_points(uuid, int, text, uuid) from public, anon;
revoke execute on function public.admin_award_badge(uuid, uuid) from public, anon;
grant execute on function
  public.admin_answer_inquiry(uuid, text),
  public.admin_grant_points(uuid, int, text, uuid),
  public.admin_award_badge(uuid, uuid)
to authenticated;
-- log_audit/grant_attendance_points는 definer 내부/트리거 전용 — authenticated grant 불필요
-- 단, log_audit는 다른 definer 함수가 호출(함수 소유자 권한)이므로 grant 없이 동작
