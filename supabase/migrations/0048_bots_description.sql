-- 봇 설명을 DB로 옮긴다. 설명이 코드에 박혀 있으면 봇을 추가할 때마다 화면을 고쳐야 한다.
-- 포인트 값·진화 임계값은 squirtle_config에서 바뀔 수 있으므로 문구에 숫자를 넣지 않는다.

alter table public.bots add column description text not null default '';

update public.bots
  set description = '매일 오전 10시 #아무말대잔치에 물 마시기 알림을 올려요. 이모지 리액션으로 하루 한 번 인증하면 포인트가 쌓이고, 모인 인증으로 꼬북이가 꼬부기 → 어니부기 → 거북왕으로 진화해요.'
  where slug = 'squirtle';
