-- 공개 지원폼 남용 방지 (2단 방어)
-- 0019는 anon insert 정책으로 모집 마감/파트만 검사한다. 하지만 (email, season) unique만으로는
-- 이메일만 바꿔 무제한 삽입이 가능하고, anon 키로 PostgREST를 직접 호출하면 앱 레이어를 우회한다.
-- (A) DB 백스톱: BEFORE INSERT 트리거로 동일인 캡 + 전역 속도 캡을 직접 호출까지 강제.
-- (B) 앱 레이어 IP 스로틀: SECURITY DEFINER RPC로 IP당 제출 횟수 제한 (submission_throttle 테이블).

-- 전역 속도 캡 백스톱이 참조하는 created_at 인덱스
create index if not exists applications_created_at_idx
  on public.applications (created_at);

-- (A) BEFORE INSERT 트리거 — anon/직접 호출 모두에 강제
create or replace function public.applications_abuse_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 동일인 캡: 이메일만 바꾼 우회 차단 (같은 시즌의 학번/연락처 중복)
  if new.student_no <> '' and exists (
    select 1 from public.applications
    where season = new.season and student_no = new.student_no
  ) then
    raise exception 'DUPLICATE_APPLICANT';
  end if;

  if new.phone <> '' and exists (
    select 1 from public.applications
    where season = new.season and phone = new.phone
  ) then
    raise exception 'DUPLICATE_APPLICANT';
  end if;

  -- 전역 속도 캡(backstop): 최근 1분 내 삽입이 20건 이상이면 차단 (대량 스크립트 완화)
  if (
    select count(*) from public.applications
    where created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  return new;
end $$;

create trigger applications_abuse_guard_trg
  before insert on public.applications
  for each row execute function public.applications_abuse_guard();

-- (B) 앱 레이어 IP 스로틀 — RPC 경유로만 접근 (직접 정책 없음)
create table public.submission_throttle (
  ip           text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

alter table public.submission_throttle enable row level security;

-- IP당 10분에 5회 초과 시 false 반환. anon/authenticated 모두 execute 허용.
create or replace function public.check_submission_rate(p_ip text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window interval := interval '10 minutes';
  v_limit int := 5;
  v_row public.submission_throttle;
begin
  -- IP 미확인 시 앱 스로틀은 통과 (DB 백스톱이 커버)
  if p_ip is null or p_ip = '' then
    return true;
  end if;

  select * into v_row from public.submission_throttle where ip = p_ip for update;

  if not found then
    insert into public.submission_throttle (ip, window_start, count)
    values (p_ip, now(), 1);
    return true;
  end if;

  if v_row.window_start < now() - v_window then
    update public.submission_throttle
      set window_start = now(), count = 1
      where ip = p_ip;
    return true;
  end if;

  if v_row.count >= v_limit then
    return false;
  end if;

  update public.submission_throttle set count = count + 1 where ip = p_ip;
  return true;
end $$;

grant execute on function public.check_submission_rate(text) to anon, authenticated;
