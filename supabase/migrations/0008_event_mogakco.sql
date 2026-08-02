-- 이벤트 유형 개편: devfest 제거, mogakco(모각코) 추가
alter table public.events
  drop constraint events_type_check;

alter table public.events
  add constraint events_type_check check (type in ('session', 'study', 'mogakco'));
