-- 설문 응답 수정 허용: 본인 응답을, 설문이 열려 있는 동안만 수정 가능
create policy "responses: own update" on public.survey_responses for update
  using (
    user_id = auth.uid()
    and exists (select 1 from public.surveys s where s.id = survey_id and s.is_open)
  )
  with check (user_id = auth.uid());
