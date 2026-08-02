# 꼬북봇 — 슬랙 리액션 기반 커뮤니티 활성화 봇

- 날짜: 2026-07-23
- 목표: 슬랙 리액션·대화량 증가와 포인트 적립
- 범위: Slack 앱 신규 + 라우트 2개 + 마이그레이션 1개 + pg_cron

> 브레인스토밍 이전의 초안(범용 `reaction_rules` 규칙 엔진 설계)은 폐기했다. 사유는 "설계 판단" 절 참조.

## 목표와 비목표

**목표** — 한 달 뒤 `#아무말대잔치`의 리액션 수와 대화량이 올라가 있고, 포인트가 실제로 쌓인다.

**비목표** — 서비스(gdg-homepage) 유입은 성공 기준이 아니다. 따라서 **봇 메시지에 외부 링크를 넣지 않는다.** 모든 상호작용은 슬랙 안에서 끝난다.

## 왜 이 설계인가 — 워크스페이스 실측 근거

`#아무말대잔치`(C02BE2ERYCC)에 이미 봇 두 개가 돌고 있고, 결과가 정반대다.

**구미베어 봇** (B06052DMZ26) — 매주 금 23:50, `> 주간 🧸 @Teddy 랭킹을 확인하세요! https://teddy.gdscdju.dev/`
2026-05-09 ~ 07-18 확인 범위에서 11주 연속 동일 문구. **리액션 0, 실제 답글 0.**

**생일 축하 봇** (GDSC Bot, U02D039M3AQ) — 2026-07-21 메시지 기준 리액션 6개(parrot_fancy 2, dancingdog4 2, yaho 2), **스레드 답글 5개.**

| | 구미베어 (실패) | 생일봇 (성공) |
|---|---|---|
| 문구 | 11주 100% 동일 | 매번 사람 이름이 바뀜 |
| 행동 | 외부 사이트 클릭 필요 | 슬랙 안에서 리액션으로 끝 |
| 동기 | 없음 | 사회적 의무 |
| 시각 | 금요일 23:50 | 00:00 (당일 내내 노출) |

여기서 나온 설계 원칙 다섯 가지. 위반하면 구미베어가 된다.

1. **슬랙 안에서 완결.** 외부 링크 금지
2. **사람을 호명한다.** 참여자 이름을 노출
3. **누르면 즉시 눈에 보이는 변화가 생긴다.** 리액션마다 스레드 갱신
4. **문구를 매번 바꾼다.** 15개 풀에서 랜덤
5. **사람이 슬랙을 보는 시간에 올린다.** KST 오전 10시

## 설계 판단

### 규칙 엔진을 만들지 않는다

선행 스펙은 `reaction_rules` 테이블로 "리액션 → 포인트"를 일반화해 공지 확인까지 덮으려 했다. 폐기한다.

진화·스레드 호명·기여도 랭킹은 전부 물 마시기 전용 기계다. 공지 확인은 진화도 랭킹도 없는 단순 규칙이라 같은 틀에 안 들어간다. 하나뿐인 규칙을 위한 규칙 엔진은 나중에 양쪽 모두를 어색하게 만든다. 공지 확인은 필요해질 때 별도로 짧게 만든다.

### 하루 1인증으로 좁힌다

**슬랙에서 한 사용자는 한 메시지에 같은 이모지를 한 번만 달 수 있다.** 따라서 "하루 3잔"을 하려면 메시지를 3개 올리거나 이모지를 3종류 써야 하고, 둘 다 지저분하다.

하루 1개 메시지 · 1인 1리액션 · 1인증으로 간다. 일일 상한 개념이 사라져 로직이 단순해지고, 하루치 인증이 스레드 하나에 모여 소셜 프루프가 가장 진해진다.

### 시즌은 달력 기준으로 끊는다

"거북왕 달성까지"로 하면 참여율이 예상보다 낮을 때 시즌이 두세 달 늘어지며 아무도 신경 쓰지 않게 된다. 달력 월로 끊으면 월말 마감 효과가 생기고, 못 채워도 도달 단계가 기록으로 남는다.

## 게임 규칙

`#아무말대잔치` 멤버 24명, 봇 3개 제외 **사람 21명** 기준으로 계산했다.

### 시즌

달력 기준 1개월. 월말에 마감하고 다음 달 1일에 새 시즌이 꼬부기부터 시작한다. 지난 시즌 기록은 남는다.

**첫 시즌 경계** — 봇을 월 중간에 띄우면 첫 시즌이 며칠짜리가 된다. 규칙을 못박는다.

- `starts_on` = 시즌 생성일
- `ends_on` = 그 달의 말일
- 단, 생성일 기준 **남은 날이 14일 미만이면** `ends_on`을 다음 달 말일로 잡는다 (첫 시즌만 길어진다)

임계값은 시즌 길이와 무관하게 `squirtle_config` 값을 그대로 쓴다. 첫 시즌이 짧으면 진화를 못 채울 수 있고, 그건 허용한다.

### 진화 단계

| 단계 | 누적 인증 | 예상 도달 |
|---|---|---|
| 꼬부기 | 0 | 시즌 시작 |
| 어니부기 | 80 | 10일차 |
| 거북왕 | 200 | 25일차 |

21명 중 하루 8명 인증(참여율 40%) 가정치.

**임계값은 `squirtle_config` 행에 두고 하드코딩하지 않는다.** 실제 참여율은 돌려보기 전에 알 수 없다. 너무 높으면 영원히 진화하지 못해 죽고, 너무 낮으면 사흘 만에 끝나 죽는다. 첫 주 실측 후 조정한다.

### 기여도 랭킹

시즌 내 인증 횟수로 센다. **평소에는 노출하지 않고** 진화 순간과 시즌 종료 시에만 1~3위를 공개한다. 상시 랭킹은 Teddy 사례에서 11주간 무시당했다.

정렬은 **인증 횟수 내림차순, 그 다음 마지막 인증 시각 오름차순**이다(같은 횟수라면 먼저 도달한 사람이 위). 참여자가 3명 미만이면 있는 만큼만 표시한다.

### 포인트

- 인증 1회 = 5포인트
- 시즌 종료 시 1/2/3위 보너스 = 30/20/10포인트

## 데이터 모델 (`supabase/migrations/0044_squirtle.sql`)

### profiles 컬럼 추가

```sql
alter table public.profiles add column slack_user_id text unique;
create index profiles_slack_user_id_idx on public.profiles (slack_user_id)
  where slack_user_id is not null;
```

`profiles`에는 email 컬럼이 없다(`0001_init.sql:2`). 이메일은 `auth.users`에만 있으므로, 최초 1회 `auth.users.email`과 슬랙 프로필 이메일을 대조해 일괄로 채운다. 서비스 가입이 의무이고 양쪽 다 gmail이라 대부분 일치할 것으로 본다. 불일치분은 어드민이 수동으로 잡는다.

### squirtle_config — 단일 행 설정

```sql
create table public.squirtle_config (
  id int primary key default 1 check (id = 1),
  channel_id text not null,
  emoji text not null,                    -- 콜론 없는 이름
  points_per_checkin int not null default 5,
  stage2_threshold int not null default 80,
  stage3_threshold int not null default 200,
  bonus_first int not null default 30,
  bonus_second int not null default 20,
  bonus_third int not null default 10
);

insert into public.squirtle_config (id, channel_id, emoji)
values (1, 'C02BE2ERYCC', 'squirtle');
```

### squirtle_seasons

```sql
create table public.squirtle_seasons (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  stage int not null default 1 check (stage between 1 and 3),
  total_count int not null default 0,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz not null default now(),
  unique (starts_on)
);
create unique index squirtle_one_active_season
  on public.squirtle_seasons ((status)) where status = 'active';
```

### squirtle_posts — 하루 한 개의 메시지

```sql
create table public.squirtle_posts (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.squirtle_seasons(id) on delete cascade,
  posted_on date not null unique,
  message_ts text not null unique,
  thread_ts text,                        -- 스레드 집계 답글. 첫 리액션 때 생성
  created_at timestamptz not null default now()
);
```

`posted_on unique`가 크론 중복 실행 시 하루 두 번 게시를 막는다.

### squirtle_checkins

```sql
create table public.squirtle_checkins (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.squirtle_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_on date not null,
  created_at timestamptz not null default now(),
  unique (season_id, user_id, checked_on)
);
```

**이 유니크 제약 하나가 멱등성의 전부다.** 중복 적립, 리액션 재부착, 슬랙 이벤트 재시도를 모두 흡수한다. 별도 방어 로직을 두지 않는다.

네 테이블 모두 RLS 활성화. 어드민 select 정책만 둔다.

### RPC: squirtle_checkin

```sql
create or replace function public.squirtle_checkin(
  p_slack_user text, p_message_ts text
) returns jsonb language plpgsql security definer set search_path = public as $$
```

동작 순서:

1. `squirtle_posts`에서 `message_ts`로 조회. 없거나 `posted_on <> (now() at time zone 'Asia/Seoul')::date`면 `{counted:false, reason:'stale'}` 반환 — 과거 메시지 리액션 차단
2. `profiles`에서 `slack_user_id`로 조회. 없으면 `{counted:false, reason:'unlinked'}`
3. `squirtle_checkins` insert (`checked_on` = 위와 같은 KST 기준 날짜). 충돌이면 `{counted:false, reason:'duplicate'}`
4. `point_logs`에 `points_per_checkin` 적립
5. `squirtle_seasons.total_count` 증가
6. 임계값을 넘겼고 `stage`가 아직 그 아래면 `stage` 갱신 + `stage_changed` 반환. **stage 갱신과 반환이 같은 트랜잭션 안에 있어야 진화 메시지가 중복 게시되지 않는다**
7. 오늘 참여자 목록과 상위 3인을 함께 반환

반환:

```json
{ "counted": true, "total": 84, "stage": 2, "stage_changed": true,
  "participants": ["U04...", "U05..."], "top3": [{"slack_user_id":"U04...","count":24}] }
```

`authenticated` 포함 전 롤에서 execute를 revoke한다(service-role 전용). `0004_phase2.sql`의 EXECUTE 봉인 관례를 따른다.

> **시간대 주의** — Supabase의 DB 타임존은 UTC다. 날짜 비교에 `current_date`를 그대로 쓰면 KST 오전 9시 이전이 전날로 계산되어 오전 리액션이 전부 `stale`로 거부된다. 날짜를 다루는 모든 지점에서 `(now() at time zone 'Asia/Seoul')::date`를 쓴다.

기존 `admin_grant_points`는 사용할 수 없다. 본문이 `is_admin()`을 검사하고 `created_by`에 `auth.uid()`를 넣는데(`0004_phase2.sql:201`), service-role은 JWT가 없어 `auth.uid()`가 null이라 반드시 실패한다. 기존 함수는 수정하지 않는다.

`point_logs.created_by`는 nullable이므로 봇 적립은 null로 둔다. 어드민 화면에서 빈 칸으로 보이지만 `reason`으로 구분 가능하다.

## 흐름 1 — 매일 아침 (`/api/cron/squirtle-daily`)

pg_cron이 KST 10:00에 호출한다.

```
1. 활성 시즌의 ends_on이 지났으면 → RPC squirtle_close_season()
     status='closed', 최종 1~3위 반환, 보너스 포인트를 point_logs에 적립
     → 반환된 순위로 시즌 종료 메시지 게시
2. 활성 시즌이 없으면 → RPC squirtle_open_season() (시즌 경계 규칙 적용)
3. 오늘의 메시지 게시 → message_ts를 squirtle_posts에 저장
4. reactions.add로 봇이 자기 메시지에 이모지를 미리 달아둔다 (첫 리액션 장벽 완화)
```

보너스 적립과 시즌 마감은 `squirtle_close_season` 안에서 원자적으로 처리한다. 크론이 두 번 돌아도 `status`가 이미 `closed`면 아무것도 하지 않고 빈 결과를 반환하므로 보너스가 중복 지급되지 않는다.

인증 절차는 기존 [event-reminder](src/app/api/cron/event-reminder/route.ts)와 동일하게 `CRON_SECRET` + `hasValidCronAuthorization`을 쓴다.

`vercel.json`은 수정하지 않는다. 기존 크론 2개가 이미 있고 Vercel 플랜 한도에 걸리므로 신규 스케줄은 전부 pg_cron으로 간다.

## 흐름 2 — 리액션 (`/api/slack/events`)

```
1. raw body를 먼저 읽는다 (await request.text())
     서명 검증에 원문이 필요하므로 request.json()을 먼저 부르면 안 된다
2. url_verification 타입이면 challenge를 그대로 반환
3. 서명 검증 실패 → 401
4. 200 즉시 반환
5. after()로 이어서:
     reaction_added 아니면 종료
     설정 이모지 아니면 종료
     event.user가 SLACK_BOT_USER_ID면 종료
     RPC squirtle_checkin 호출
     counted=false면 종료
     스레드 답글 갱신 (thread_ts 있으면 chat.update, 없으면 postMessage 후 저장)
     stage_changed면 진화 축하 메시지 게시
```

`after()`는 Next 16.2.10에서 `next/server`로 제공되는 정식 API다(`node_modules/next/server.d.ts:21`). 200을 먼저 돌려주고 Slack API 호출을 이어가므로 3초 제약에 걸리지 않는다.

## 메시지

### 일일 메시지 (15개 풀에서 랜덤)

```
🐢 꼬북이가 물을 한 잔 마셨어요. 여러분도 한 잔 어때요?
   :squirtle: 눌러서 함께해요!
```

문구를 매번 바꾸는 것은 필수다. 구미베어는 11주간 한 글자도 바뀌지 않았고 반응이 0이었다.

### 스레드 집계 답글

리액션마다 **이 답글 하나를 `chat.update`로 수정**한다. 새 답글을 달지 않으므로 스레드가 도배되지 않고, 슬랙은 메시지 수정 시 알림을 울리지 않아 조용히 갱신된다.

```
🐢 오늘 8명이 꼬북이와 함께했어요!
   @Aqua @June @Judy @Dean @nova @Lumi @Ryan @Blue
   거북왕까지 42잔 남았어요
```

거북왕 도달 후에는 "남은 잔" 문구를 뺀다.

### 진화 축하

```
🎉 꼬북이가 거북왕으로 진화했어요!
   이번 시즌 200잔 달성 🏆

   🥇 @Aqua 24잔
   🥈 @June 22잔
   🥉 @Judy 19잔

   함께해준 21명 모두 고마워요!
```

시즌 종료 메시지도 같은 형식에 최종 단계와 보너스 안내를 덧붙인다.

> 예시의 `@Aqua`는 실제로는 `<@U04JNJQQX2T>` 형식으로 보낸다. 슬랙이 알아서 멘션으로 렌더링하므로 표시 이름을 따로 조회할 필요가 없다. RPC는 `slack_user_id`만 반환하면 된다.

## 에러 처리

### 어뷰징 차단 — 오늘 메시지에만 인정

리액션은 과거 메시지에도 달 수 있다. 지난 30일 메시지를 훑으며 전부 누르면 한 번에 30인증이 들어간다. RPC 1단계에서 `posted_on <> current_date`면 거부한다.

### 실패 모드

| 상황 | 처리 |
|---|---|
| 서명 검증 실패 | 401, 무시 |
| timestamp 5분 초과 (리플레이) | 401, 무시 |
| 슬랙 이벤트 재시도 | `unique(season, user, checked_on)`이 흡수 |
| 리액션 뗐다 다시 달기 | 같은 제약이 흡수. 추가 적립 없음 |
| `after()` 내 Slack API 실패 | DB는 커밋됨. 스레드만 어긋남 → 다음 리액션 때 자동 정정. 재시도하지 않음 |
| 스레드 메시지 삭제됨 | `message_not_found` 수신 시 `thread_ts`를 비우고 다음 리액션 때 재생성 |
| `slack_user_id` 미등록 | `counted:false` 반환, 조용히 종료 + 로그 |
| 크론 중복 실행 | `posted_on unique`가 차단 |
| 크론 실패로 하루 누락 | 그날 인증 없음. 총량만 덜 참. 복구하지 않음 |
| 진화 메시지 중복 | stage 갱신과 `stage_changed` 반환이 같은 트랜잭션 |
| 봇 자신의 리액션 | `SLACK_BOT_USER_ID` 대조 후 무시 |

**재시도 큐를 두지 않는 것은 의도한 선택이다.** 자가 치유되는 상태(스레드 표시)에 재시도를 붙이면 코드가 두 배가 되고 버그가 살 곳이 생긴다. 어긋나도 다음 리액션 하나로 맞춰진다.

### `reaction_removed`

구독하지 않는다. 포인트를 회수하지 않는다.

### pg_cron의 시크릿

`CRON_SECRET`은 기존 크론 두 개와 공유하는 값이라, pg_cron 스케줄에 평문으로 두면 유출 시 그쪽까지 뚫린다. **Supabase Vault에 넣고 참조로 쓴다.**

```sql
select cron.schedule(
  'squirtle-daily', '0 1 * * *',          -- UTC 01:00 = KST 10:00
  $$ select net.http_post(
       url := 'https://gdg-homepage.vercel.app/api/cron/squirtle-daily',
       headers := jsonb_build_object('Authorization',
         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                       where name = 'cron_secret'))
     ) $$
);
```

`pg_cron`·`pg_net` extension 활성화가 선행되어야 한다.

## 코드 배치

```
src/app/api/slack/events/route.ts          수신 + 검증 + after()
src/app/api/cron/squirtle-daily/route.ts   일일 게시 + 시즌 전환
src/lib/slack/verify.ts                    서명 검증
src/lib/slack/api.ts                       postMessage / update (봇 토큰)
src/lib/squirtle/messages.ts               문구 풀, 스레드·진화 메시지 조립
supabase/migrations/0044_squirtle.sql
tests/squirtle.test.ts
```

기존 `src/lib/slack.ts`의 `postSlack`은 Incoming Webhook 전용이라 채널 지정과 ts 반환이 안 된다. 봇 토큰용 함수를 `src/lib/slack/api.ts`에 새로 두고 `postSlack`은 수정하지 않는다.

Slack API는 실패해도 HTTP 200에 `{ok:false}`를 주므로 **응답 body의 `ok`를 반드시 확인**한다.

## 환경변수

| 이름 | 용도 |
|---|---|
| `SLACK_BOT_TOKEN` | `chat.postMessage` / `chat.update` |
| `SLACK_SIGNING_SECRET` | 이벤트 서명 검증 |
| `SLACK_BOT_USER_ID` | 봇 자신의 리액션 무시 |

`CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`는 이미 있다.

## 테스트

### `tests/squirtle.test.ts` (vitest)

**서명 검증** — 유효한 서명 통과 / body 변조 거부 / 5분 초과 거부 / 헤더 누락·형식 오류 거부

**메시지 조립** — 참여자 수와 남은 잔 수 반영 / 거북왕 도달 시 "남은 잔" 문구 제거 / 진화 축하의 1~3위 순서와 동점자 처리 / 참여자 0명일 때 답글 미생성

**라우트 분기** — `url_verification` challenge 반환 / `reaction_added` 외 무시 / 봇 자신 리액션 무시 / 미설정 이모지 무시

**마이그레이션 정적 검증** — `unique (season_id, user_id, checked_on)` 존재 / RPC가 `public, anon, authenticated`에서 revoke됨

### 배포 후 수동 시나리오

DB 로직은 로컬 Supabase 없이 단위 테스트가 어렵다. 배포 후 다음 순서로 확인한다.

1. 리액션 → 스레드에 이름이 뜨고 포인트 적립
2. 뗐다 다시 달기 → 변화 없음
3. 어제 메시지에 리액션 → 무시됨
4. 임계값을 임시로 3으로 낮춤 → 진화 메시지와 1~3위 확인 → 원복

### 검증 커맨드

```bash
npm run build && npm test
```

`tests/accessibility-primitives.test.ts`는 eslint 미설치로 클린 트리에서도 실패하는 기존 지뢰다. 이 작업과 무관하므로 손대지 않는다.

## 수동 작업 (코드로 불가)

1. api.slack.com에서 앱 생성, 워크스페이스 = gdscdaejinuniversity
2. Bot Token Scopes: `chat:write`(게시·수정), `reactions:read`(리액션 이벤트 수신), `reactions:write`(봇이 자기 메시지에 이모지 선점)
3. 워크스페이스 설치 → Bot Token(`xoxb-`) 확보
4. **`#아무말대잔치`(C02BE2ERYCC)에 봇 초대** — 하지 않으면 이벤트가 오지 않는다
5. Event Subscriptions Request URL = `https://gdg-homepage.vercel.app/api/slack/events` → `url_verification` 통과 확인
6. Subscribe to bot events: `reaction_added`
7. 봇 user ID를 `SLACK_BOT_USER_ID`에 설정
8. Supabase에서 `pg_cron`·`pg_net` 활성화, Vault에 `cron_secret` 등록, 스케줄 등록
9. `profiles.slack_user_id` 일괄 백필

`#bot-꼬북봇`(C0BK8T33GHG)은 사용하지 않는다. 전용 채널은 "들어가야 볼 수 있음"이라는 장벽을 더한다. 구미베어는 사람들이 이미 있는 채널에 올리는데도 무시당했다. 삭제하거나 개발용으로 남긴다.

## 스코프 밖

- 기존 `postSlack`, `admin_grant_points`, `vercel.json`
- `reaction_removed` 처리
- 공지 확인 리액션 — 필요해질 때 별도 설계
- 서비스 유입 유도 (링크·배너 등) — 성공 기준이 아니며 구미베어의 실패 경로
- `tests/accessibility-primitives.test.ts`
