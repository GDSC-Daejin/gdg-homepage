# 포켓몬 수집·도감 설계

## 목표

회원이 슬랙 `#아무말대잔치`에서 하루 한 번 몬스터볼 이모지로 야생 포켓몬을 포획하고, 서비스의 개인 도감에서 1세대 포켓몬 수집 현황과 중복 보유 수를 확인한다.

## 범위와 비범위

- 첫 릴리스는 1세대 25종, 기본 몬스터볼, 개인 도감, 슬랙 출현·포획만 제공한다.
- 하루에 3마리가 KST 07:00~23:00 사이에 한 번씩 출현한다. 출현은 서로 겹치지 않는다.
- 각 회원은 세 출현 중 하나에만 하루 한 번 볼을 던질 수 있다.
- 중복 포획은 허용하고 같은 포켓몬의 보유 수를 누적한다.
- 상위 볼 지급 기준은 꼬북봇의 진화 기여율과 연결하는 방향으로 추후 결정한다. 첫 릴리스에는 기본 몬스터볼 외 볼을 지급하거나 사용할 수 없다.
- 교환, 배틀, 서비스에서의 포획 버튼, 공개 도감·랭킹, 포켓몬별 출현 확률 조정 UI는 만들지 않는다.

## 초기 도감

초기 후보는 다음 25종이며, 세 출현은 활성 후보에서 동일 확률로 중복 없이 고른다. 카드 이미지는 `public/pokemon/{pokedex_no}.png`에 둔다.

| 등급 | 포켓몬 | 기본 포획률 | 체류시간 |
| --- | --- | ---: | ---: |
| 보통 | 이상해씨, 파이리, 꼬부기, 피카츄, 푸린, 나옹, 고라파덕, 가디, 포니타 | 60% | 90분 |
| 어려움 | 이상해풀, 리자드, 어니부기, 라이츄, 이브이, 샤미드, 쥬피썬더, 부스터, 고오스 | 40% | 60분 |
| 희귀 | 이상해꽃, 리자몽, 거북왕, 팬텀, 미뇽, 라프라스, 잠만보 | 20% | 30분 |

포획 판정은 `min(100%, 포켓몬 기본 포획률 × 볼 보정치)`다. 기본 몬스터볼의 보정치는 `1.0`이다. 기본 포획률과 체류시간은 도감에 표시하지 않는다.

## 일일 일정과 볼 지급

1. KST 00:00 작업은 `status='active'`이고 `role <> 'applicant'`인 회원의 기본 몬스터볼을 1개 충전한다. 이미 3개면 수량을 유지한다.
2. 같은 작업은 그날의 포켓몬 3종과 각 출현 시각을 확정해 저장한다.
3. 시작 시각은 07:00 이상, 종료 시각은 23:00 이하로 고른다. 체류시간을 포함해 세 출현이 겹치지 않도록 다시 뽑는다.
4. 매분 실행되는 출현 작업은 `posting_started_at`이 10분 지난 `posting` 행을 `scheduled`로 되돌린 뒤, 시작 시각이 지난 미게시 출현 하나를 DB에서 선점해 슬랙에 게시한다. 종료 시각이 지난 미게시 출현은 `expired`로 바꾸고 게시하지 않는다.
5. 슬랙 게시가 실패하면 선점을 풀어 다음 실행에서 재시도한다. 성공하면 슬랙 원글의 `ts`를 출현 기록에 저장하고 `posted`로 바꾼다.

일일 볼 지급은 지급 이력의 `(회원, KST 날짜, 볼 종류)` 고유 제약으로, 출현 일정은 `(KST 날짜, 출현 순서)` 고유 제약으로 중복 실행을 막는다.

## 슬랙 포획 흐름

도감봇은 출현 원글에 기본 몬스터볼 이모지를 붙인다. 회원은 원글에 그 이모지를 눌러 포획한다.

1. 이벤트 수신기는 도감봇이 게시한 살아 있는 출현 원글의 기본 볼 반응만 처리한다.
2. 포획 RPC는 슬랙 계정 연결, 당일 시도 이력, 출현 종료 시각, 볼 보유 수를 한 트랜잭션에서 검증한다.
3. 유효하면 볼을 1개 차감하고 난수를 한 번 굴린 뒤 `pokemon_throws`에 성공 또는 실패를 기록한다. `(회원, KST 날짜)` 고유 제약으로 리액션 중복·슬랙 재전송에도 한 번만 처리한다.
4. 봇은 원글 스레드에 다음 두 댓글을 순서대로 남긴다.

   ```text
   <@U123>이 몬스터볼을 던졌어요!
   🎉 <@U123>이 꼬부기 포획에 성공했어요!
   ```

   실패 시 두 번째 댓글은 `아쉽게도 꼬부기가 도망쳤어요.`로 바꾼다.

5. 성공이면 `#아무말대잔치`에 다음 새 원글을 추가한다.

   ```text
   🎉 <@U123>이 꼬부기 포획에 성공했어요!
   ```

6. 종료된 출현에는 `꼬부기는 이미 사라졌어요.`, 당일 재시도에는 `오늘은 이미 몬스터볼을 던졌어요.`, 볼 부족에는 `몬스터볼이 없어요.`를 스레드에 남긴다. 이 세 경우는 볼을 차감하거나 포획 이력을 만들지 않는다.

리액션을 제거해도 이미 확정된 포획 결과와 볼은 되돌리지 않는다. 슬랙 댓글 게시가 실패해도 포획 결과는 DB에 남고 도감에는 반영된다.

## 데이터 모델

### `pokemon_catalog`

포켓몬의 정적 정의다.

- `id uuid primary key`
- `pokedex_no int unique not null`
- `name_ko text unique not null`
- `image_path text not null`
- `catch_rate numeric not null check (catch_rate > 0 and catch_rate <= 1)`
- `dwell_minutes int not null check (dwell_minutes in (30, 60, 90))`
- `active boolean not null default true`

### `pokemon_ball_types`

볼의 정적 정의다. 기본 몬스터볼 한 행만 시드한다.

- `slug text primary key`
- `name_ko text not null`
- `slack_emoji text unique not null`
- `capture_multiplier numeric not null check (capture_multiplier > 0)`
- `active boolean not null default true`

기본 행은 `poke_ball`, `몬스터볼`, `pokeball`, `1.0`, `true`다.

### `pokemon_ball_inventory`

회원별 볼 수량이다.

- `user_id uuid references profiles(id) on delete cascade`
- `ball_slug text references pokemon_ball_types(slug)`
- `quantity int not null check (quantity >= 0)`
- `primary key (user_id, ball_slug)`

### `pokemon_ball_grants`

기본 볼 자동 지급의 멱등성 기록이다.

- `user_id uuid references profiles(id) on delete cascade`
- `ball_slug text references pokemon_ball_types(slug)`
- `granted_on date not null`
- `primary key (user_id, ball_slug, granted_on)`

### `pokemon_appearances`

하루에 예정되거나 게시된 공용 출현이다.

- `id uuid primary key`
- `appears_on date not null`
- `appearance_order smallint not null check (appearance_order between 1 and 3)`
- `pokemon_id uuid references pokemon_catalog(id)`
- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `status text not null check (status in ('scheduled', 'posting', 'posted', 'expired'))`
- `posting_started_at timestamptz`
- `message_ts text unique`
- `unique (appears_on, appearance_order)`

### `pokemon_throws`

하루 한 번의 포획 판정과 성공한 중복 포획 수의 원천 기록이다.

- `id uuid primary key`
- `user_id uuid references profiles(id) on delete cascade`
- `appearance_id uuid references pokemon_appearances(id) on delete restrict`
- `pokemon_id uuid references pokemon_catalog(id) on delete restrict`
- `ball_slug text references pokemon_ball_types(slug)`
- `attempted_on date not null`
- `outcome text not null check (outcome in ('caught', 'escaped'))`
- `created_at timestamptz not null default now()`
- `unique (user_id, attempted_on)`

## 권한과 서비스 화면

- 포켓몬 목록과 게시된 출현은 승인된 회원이 읽을 수 있다.
- 볼 인벤토리와 포획 이력은 본인 또는 관리자만 읽을 수 있다.
- 볼 지급·출현 예약·출현 게시 상태·포획 기록의 쓰기는 보안 정의 RPC와 서비스 역할의 스케줄러만 수행한다.
- `/pokedex`는 본인 기준으로 획득 종 수, 기본 볼 보유 수, 25종 카드 그리드를 표시한다.
- 미획득 카드는 실루엣으로, 획득 카드는 이미지·이름·`N마리 보유`로 표시한다.

## 봇 운영

기존 봇 스위치판에 `pokedex` 슬러그의 도감봇을 추가한다. 도감봇을 끄면 새 일정 게시와 일일 지급은 중단한다. 이미 게시된 출현은 원래 종료 시각까지 포획할 수 있다.

## 검증 기준

- 동일한 일일 작업을 여러 번 실행해도 기본 볼은 하루에 한 번만 지급되고 3개를 넘지 않는다.
- 일일 출현은 정확히 3개이며 KST 07:00~23:00 안에서 서로 겹치지 않는다.
- 살아 있는 출현에서만, 연결된 회원이 보유한 볼로 하루 한 번 포획할 수 있다.
- 만료·볼 부족·당일 재시도는 볼과 포획 이력을 바꾸지 않는다.
- 성공·실패·중복 포획은 예상한 인벤토리·도감 보유 수를 만든다.
- 슬랙 이벤트는 스레드의 던지기 댓글과 결과 댓글을 순서대로 게시하고, 성공 시 별도 성공 원글을 게시한다.
- `/pokedex`는 다른 회원의 인벤토리·포획 이력을 읽지 않는다.
