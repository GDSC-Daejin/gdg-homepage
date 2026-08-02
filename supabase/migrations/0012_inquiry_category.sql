-- 문의/건의에 유형(카테고리) 추가
-- general(일반) / suggestion(건의) / bug(버그) / activity(활동) / etc(기타)
alter table public.inquiries
  add column category text not null default 'general'
  check (category in ('general', 'suggestion', 'bug', 'activity', 'etc'));
