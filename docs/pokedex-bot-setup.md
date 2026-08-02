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
```

첫 스케줄은 UTC 15:00, 즉 KST 자정에 기본 몬스터볼 지급과 그날의 세 출현을 예약한다. 두 번째 스케줄은 예정된 출현을 게시한다.

6. `#아무말대잔치`에서 도감봇이 메시지와 `:pokeball:` 반응을 올릴 수 있는지 확인한다.
