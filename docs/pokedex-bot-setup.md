# 도감봇 운영 설정

1. Slack 워크스페이스에 이름이 `pokeball`인 커스텀 이모지를 추가하고, 도감봇을 `#아무말대잔치`에 초대한다.
2. 배포 환경 변수에 도감봇 앱의 값을 등록한다. 기존 `SLACK_*` 값은 꼬북봇용이므로 재사용하지 않는다.

```text
POKEDEX_SLACK_BOT_TOKEN=xoxb-...
POKEDEX_SLACK_SIGNING_SECRET=...
```

3. 배포 후 도감봇 Slack 앱의 **Event Subscriptions**를 활성화하고 Request URL을 `https://gdg-homepage.vercel.app/api/slack/pokedex/events`로 설정한다. Bot Events에는 `reaction_added`를 추가한다.
4. Supabase SQL Editor에서 `0057_pokedex.sql`을 적용한다.
5. 기존 `cron_secret` Vault 시크릿을 사용해 다음 두 스케줄을 등록한다. 배포 도메인은 실제 서비스 주소로 바꾼다.

```sql
select cron.schedule(
  'pokedex-daily', '0 15 * * *',
  $$ select net.http_get(
       url := 'https://gdg-homepage.vercel.app/api/cron/pokedex-daily',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
       )
     ); $$
);

select cron.schedule(
  'pokedex-spawn', '* * * * *',
  $$ select net.http_get(
       url := 'https://gdg-homepage.vercel.app/api/cron/pokedex-spawn',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
       )
     ); $$
);

select cron.schedule(
  'pokedex-ranking', '10 1 * * *',
  $$ select net.http_get(
       url := 'https://gdg-homepage.vercel.app/api/cron/pokedex-ranking',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
       )
     ); $$
);
```

첫 스케줄은 UTC 15:00, 즉 KST 자정에 기본 몬스터볼 지급과 그날의 세 출현을 예약한다. 두 번째 스케줄은 예정된 출현을 게시한다. 세 번째 스케줄은 UTC 01:10, 즉 KST 오전 10:10에 보유 종 수 상위 3명을 도감봇으로 공지한다.

6. `#아무말대잔치`에서 도감봇이 메시지와 `:pokeball:` 반응을 올릴 수 있는지 확인한다.

## 테스트 포켓몬 수동 출현

운영자가 “파이리를 30분간 테스트 출현”처럼 요청하면 아래 절차로 처리한다. Slack API로 직접 메시지를 보내지 말고, 반드시 출현 크론 경로를 호출한다. 그래야 이미지와 `:pokeball:` 반응이 함께 생성된다.

1. Supabase 원격 DB에서 테스트용 출현을 등록한다. `파이리`와 `30 minutes`를 요청값으로 바꿀다. 과거 `appears_on` 슬롯을 쓰므로 실제 하루 3회 예약과 출돌하지 않는다.

```sql
with free_slot as (
  select day::date as appears_on, slots.appearance_order
  from generate_series(
    ((now() at time zone 'Asia/Seoul')::date - 1),
    ((now() at time zone 'Asia/Seoul')::date - 365),
    '-1 day'
  ) as day
  cross join generate_series(1, 3) as slots(appearance_order)
  left join pokemon_appearances pa
    on pa.appears_on = day::date and pa.appearance_order = slots.appearance_order
  where pa.id is null
  order by day desc, slots.appearance_order
  limit 1
)
insert into pokemon_appearances (appears_on, appearance_order, pokemon_id, starts_at, ends_at)
select free_slot.appears_on, free_slot.appearance_order, catalog.id,
  now() - interval '5 seconds', now() + interval '30 minutes'
from free_slot
join pokemon_catalog catalog on catalog.name_ko = '파이리'
returning id, starts_at, ends_at;
```

2. Vault의 `cron_secret`으로 출현 경로를 1회 호출한다. 반환된 `request_id`를 기록한다.

```sql
select net.http_get(
  url := 'https://gdg-homepage.vercel.app/api/cron/pokedex-spawn',
  headers := jsonb_build_object(
    'Authorization',
    'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
  )
) as request_id;
```

3. `request_id`로 응답을 확인한다. `200` 과 `{"posted":true}`면 성공이다. 같은 레코드의 `message_ts`가 채워져 있는지도 보고 Slack 메시지에 이미지가 포함됐는지 확인한다.

```sql
select status_code, content
from net._http_response
where id = <request_id>;
```

### 테스트 몬스터볼 지급

요청에 “전원을 3개로 맞춰줘”가 포함되면 아래 SQL로 활성 비지원자 회원의 기본 몬스터볼을 정확히 3개로 맞춘다.

```sql
insert into pokemon_ball_inventory (user_id, ball_slug, quantity)
select id, 'poke_ball', 3
from profiles
where status = 'active' and role <> 'applicant'
on conflict (user_id, ball_slug) do update
  set quantity = 3;
```
