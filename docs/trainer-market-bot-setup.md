# 트레이너 마켓봇 월요일 배포 체크리스트

## 1. 마이그레이션과 환경 변수

배포 전에 새 마이그레이션을 적용한다.

```bash
supabase db push
```

Vercel에는 아래 값을 둔다. 기존 꼬북봇과 같은 Slack 앱을 쓴다면 `TRAINER_SLACK_SIGNING_SECRET`과 `TRAINER_SLACK_BOT_TOKEN`은 생략할 수 있고, 기존 도감봇 서명 비밀값과 `SLACK_BOT_TOKEN`을 재사용한다.

| 이름 | 값 |
| --- | --- |
| `TRAINER_SLACK_SIGNING_SECRET` | Slack 앱의 Signing Secret |
| `TRAINER_SLACK_BOT_TOKEN` | 트레이너 마켓봇의 `xoxb-` 토큰 |
| `CRON_SECRET` | 기존 크론 인증 비밀값 |
| `NEXT_PUBLIC_SUPABASE_URL` | 기존 값 |
| `SUPABASE_SERVICE_ROLE_KEY` | 기존 값 |

## 2. Slack 앱

Slash Commands에 아래 명령을 추가한다.

| 항목 | 값 |
| --- | --- |
| Command | `/포켓몬` |
| Request URL | `https://gdg-homepage.vercel.app/api/slack/trainer/command` |
| Short description | 포켓몬 메뉴를 열어요 |

Interactivity & Shortcuts를 켜고 Request URL을 `https://gdg-homepage.vercel.app/api/slack/trainer/actions`로 둔다. Bot Token Scopes에는 `chat:write`, `commands`를 추가하고, 포켓몬 주식 소식을 올릴 채널에 봇을 초대한다.

공개 채널은 기존 `squirtle_config.channel_id`를 재사용한다. 필요하다면 먼저 그 값을 운영 채널 ID로 바꾼다.

## 3. 포켓몬 주식 크론

Supabase SQL Editor에서 실행한다. Vault의 `cron_secret`은 기존 값이 있으면 재사용한다.

```sql
select cron.schedule(
  'trainer-market-open',
  '0 0 * * *', -- UTC 00:00 = KST 09:00
  $$ select net.http_post(
       url := 'https://gdg-homepage.vercel.app/api/cron/trainer-market-open',
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
     ) $$
);

select cron.schedule(
  'trainer-market-news',
  '30 1 * * *', -- UTC 01:30 = KST 10:30, 여섯 종목 뉴스를 한 번에 발송
  $$ select net.http_post(
       url := 'https://gdg-homepage.vercel.app/api/cron/trainer-market-news',
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
     ) $$
);

select cron.schedule(
  'trainer-market-close',
  '0 13 * * *', -- UTC 13:00 = KST 22:00
  $$ select net.http_post(
       url := 'https://gdg-homepage.vercel.app/api/cron/trainer-market-close',
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
     ) $$
);
```

## 4. 월요일 전 확인

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://gdg-homepage.vercel.app/api/cron/trainer-market-open
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://gdg-homepage.vercel.app/api/cron/trainer-market-close
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://gdg-homepage.vercel.app/api/cron/trainer-market-news
```

첫 명령은 포켓몬 주식 응원판과 DB 뉴스 풀의 그날 뉴스 여섯 건을 준비한다. 뉴스 크론은 10:30에 여섯 종목 뉴스를 하나의 Slack 알림으로 발송하고, 장마감 크론은 종가와 장마감 브리핑을 게시한다. 실제 운영 전 테스트한 날짜의 시장 기록은 그대로 남으므로, 테스트는 운영 시작 전날에 하거나 테스트용 Supabase 프로젝트에서 한다.
