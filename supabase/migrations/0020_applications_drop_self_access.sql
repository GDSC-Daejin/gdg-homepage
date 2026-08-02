-- "applications: own" / "own insert" 정책은 로그인한 본인이 자기 지원서를 보거나
-- 자기 applicant_id로 직접 insert하는 기능을 위해 만들어졌으나, 앱 어디에도 이 기능이 없다.
-- 그런데 review_note(어드민 전용 심사 메모, 0017)는 행 단위 RLS라 이 정책을 통해
-- 본인 확인된 사용자에게 그대로 노출된다. 미사용 셀프 접근 경로를 제거해 노출을 막는다.

drop policy "applications: own" on public.applications;
drop policy "applications: own insert" on public.applications;

create policy "applications: admin select"
  on public.applications for select
  using (public.is_admin());
