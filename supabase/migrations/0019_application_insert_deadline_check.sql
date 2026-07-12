-- anon insert 정책이 applicant_id만 검사해 공개 anon 키로 PostgREST를 직접 호출하면
-- 모집 마감(is_open=false)이나 모집하지 않는 파트에도 지원서가 insert될 수 있었음.
-- recruiting_settings와 대조하는 조건을 추가해 애플리케이션 레이어 검증을 DB에서도 강제한다.

drop policy "applications: anon insert" on public.applications;

create policy "applications: anon insert"
  on public.applications for insert to anon
  with check (
    applicant_id is null
    and exists (
      select 1 from public.recruiting_settings rs
      where rs.id = 1
        and rs.is_open
        and rs.season = applications.season
        and applications.position = any(rs.open_positions)
    )
  );
