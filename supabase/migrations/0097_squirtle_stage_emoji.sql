-- 진화하면 누르는 이모지도 바뀐다 — 단계별 이모지를 설정 손잡이로 뺀다.
-- 이전 단계 이모지도 계속 인정한다: 진화는 하루 중간에 일어나는데
-- 이미 게시된 오늘 메시지에는 이전 단계 씨앗만 달려 있기 때문이다.
-- 그때 이전 이모지를 거절하면 아직 안 마신 사람이 눌러도 아무 일이 안 일어난다.

alter table public.squirtle_config
  add column emoji_stage2 text,
  add column emoji_stage3 text;

comment on column public.squirtle_config.emoji is
  '1단계(꼬부기) 이모지. 콜론 없는 이름.';
comment on column public.squirtle_config.emoji_stage2 is
  '2단계(어니부기) 이모지. null이면 1단계 이모지를 그대로 쓴다.';
comment on column public.squirtle_config.emoji_stage3 is
  '3단계(거북왕) 이모지. null이면 아래 단계 이모지를 그대로 쓴다.';

-- 워크스페이스에 :wartortle:는 등록돼 있고 :blastoise:는 아직 없다.
-- 없는 이름으로 reactions.add를 부르면 invalid_name으로 실패하므로 3단계는 비워둔다.
update public.squirtle_config set emoji_stage2 = 'wartortle' where id = 1;
