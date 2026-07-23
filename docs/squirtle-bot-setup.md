# 꼬북봇 배포 체크리스트

설계서: `docs/superpowers/specs/2026-07-23-squirtle-bot-design.md`

## 1. Slack 앱 생성

1. https://api.slack.com/apps → Create New App → From scratch
2. 앱 이름 `꼬북봇`, 워크스페이스 `gdscdaejinuniversity`

## 2. Bot Token Scopes

OAuth & Permissions → Scopes → Bot Token Scopes에 추가:

| 스코프 | 용도 |
|---|---|
| `chat:write` | 일일 메시지·스레드 답글 게시와 수정 |
| `reactions:read` | `reaction_added` 이벤트 수신 |
| `reactions:write` | 봇이 자기 메시지에 이모지 선점 |
| `users:read` | 신규 가입자 계정 백필 |
| `users:read.email` | 이메일 대조 |

## 3. 워크스페이스 설치

Install to Workspace → Bot User OAuth Token(`xoxb-`) 복사

## 4. 채널 초대 (빠뜨리면 이벤트가 오지 않음)

`#아무말대잔치`(C02BE2ERYCC)에서 `/invite @꼬북봇`

`#bot-꼬북봇`(C0BK8T33GHG)은 사용하지 않는다. 전용 채널은 "들어가야 볼 수 있음"이라는 장벽을 더한다.

## 5. 환경변수 (Vercel)

| 이름 | 값 |
|---|---|
| `SLACK_BOT_TOKEN` | 3단계의 `xoxb-` 토큰 |
| `SLACK_SIGNING_SECRET` | Basic Information → Signing Secret |
| `SLACK_BOT_USER_ID` | 아래 6단계에서 확인 |

`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`는 이미 있다.

## 6. 봇 User ID 확인

슬랙에서 꼬북봇 프로필 → 더보기 → Copy member ID (`U`로 시작). `SLACK_BOT_USER_ID`에 넣는다.

## 7. 마이그레이션 적용

```bash
supabase db push
```

중복 버전 때문에 막히면 `supabase migration list`로 원격 상태부터 확인한다.

## 8. Event Subscriptions

**7단계 배포가 끝난 뒤에 한다.** URL 검증이 실서버를 때린다.

1. Event Subscriptions → Enable Events
2. Request URL: `https://gdg-homepage.vercel.app/api/slack/events`
3. Verified 표시 확인 (실패하면 `SLACK_SIGNING_SECRET` 확인)
4. Subscribe to bot events → `reaction_added` 추가 → Save Changes

## 9. Supabase 스케줄

SQL Editor에서 실행한다. `pg_cron`·`pg_net` extension을 먼저 켠다(Database → Extensions).

```sql
-- CRON_SECRET을 Vault에 넣는다 (평문으로 두면 기존 크론 2개까지 함께 뚫린다)
select vault.create_secret('<CRON_SECRET 값>', 'cron_secret');

select cron.schedule(
  'squirtle-daily',
  '0 1 * * *',                              -- UTC 01:00 = KST 10:00
  $$ select net.http_post(
       url := 'https://gdg-homepage.vercel.app/api/cron/squirtle-daily',
       headers := jsonb_build_object(
         'Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                       where name = 'cron_secret'))
     ) $$
);
```

등록 확인:

```sql
select jobid, schedule, jobname from cron.job where jobname = 'squirtle-daily';
```

## 10. 동작 확인

크론을 기다리지 말고 직접 호출한다.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://gdg-homepage.vercel.app/api/cron/squirtle-daily
```

`{"posted":true,"linked":N,"closed":false}`가 나오고 `#아무말대잔치`에 메시지가 올라오면 성공이다.

이어서 수동 시나리오 4개를 확인한다.

1. 리액션 → 스레드에 이름이 뜨고 포인트 적립
2. 리액션을 뗐다 다시 달기 → 변화 없음
3. 어제 메시지에 리액션 → 무시됨
4. 임계값을 임시로 낮춰 진화 확인 후 원복

```sql
-- 4번 테스트용
update squirtle_config set stage2_threshold = 1, stage3_threshold = 2 where id = 1;
-- 확인 후 반드시 원복
update squirtle_config set stage2_threshold = 80, stage3_threshold = 200 where id = 1;
```

## 첫 주 이후 — 임계값 조정 (필수)

80/200은 참여율 40% 가정치다. 실측 후 반드시 조정한다.

```sql
select s.starts_on, s.stage, s.total_count,
       count(distinct c.user_id) as 참여자수,
       round(s.total_count::numeric / greatest(current_date - s.starts_on, 1), 1) as 하루평균
  from squirtle_seasons s
  left join squirtle_checkins c on c.season_id = s.id
  where s.status = 'active'
  group by s.id, s.starts_on, s.stage, s.total_count;
```

하루평균 × 시즌일수가 `stage3_threshold` 근처가 되도록 맞춘다.
