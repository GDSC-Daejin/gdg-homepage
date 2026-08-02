# 이벤트 진행시간 · 장소/주소 개선 설계

## 배경 / 문제

현재 `Event` 모델은 `starts_at`(시작 일시)와 `location`(장소) 필드만 있다. 종료시간·주소를 담을 구조화 필드가 없어서, 어드민이 다음을 **설명(description)란에 손으로 밀어넣고** 있다.

- `"일시: 7월 23일 목요일 오후 12시~4시"` — 종료시간 필드 부재
- `"주소: 서울특별시 도봉구 마들로11길 75"` — 주소 필드 부재

결과적으로 장소 정보가 `location` 필드와 `description`에 **중복·분산**되어 불일치 위험이 있고, 어드민 입력도 번거롭다.

## 목표

1. 세션 **진행시간**(시작~종료)을 구조화 필드로 입력·표시
2. **장소명**과 **주소**를 분리된 구조화 필드로 관리
3. `description`은 순수 안내문만 담도록 정리(강제는 아니고 필드 제공)

## 결정 사항

- 진행시간: **종료 일시(`ends_at`) 추가** (nullable — 시간 미정 이벤트 허용)
- 장소/주소: **장소명(`location`) + 주소(`address`) 분리**
- 주소에 **구글맵 검색 링크** + **복사 버튼** 제공

## 데이터 모델

마이그레이션: `supabase/migrations/0011_event_time_location.sql`

```sql
alter table public.events add column ends_at timestamptz;              -- nullable
alter table public.events add column address text not null default ''; -- 도로명주소
```

- `location` = 장소명 (예: `서울 청년센터 도봉 1층 프로그램실 2`) — 기존 필드 의미 유지
- `address` = 주소 (예: `서울특별시 도봉구 마들로11길 75`) — 신규
- `ends_at` = 종료 일시 (nullable)

기존 데이터 백필 불필요: `address`는 기본값 `''`, `ends_at`은 null. 표시 로직이 빈 값/null을 fallback 처리한다.

## 타입 / 스키마

`src/lib/types.ts` — `Event`에 추가:
```ts
ends_at: string | null;
address: string;
```

`src/lib/schemas.ts` — `eventSchema`에 추가:
```ts
ends_at: z.string().optional().nullable(),  // 폼에서 빈 값 → null 정규화
address: z.string(),
```

**검증**: `ends_at`이 존재하면 `starts_at`보다 뒤여야 한다(`.refine` 또는 폼 제출 전 체크). 아니면 에러 메시지.

## 어드민 폼 (`src/app/admin/events/EventForm.tsx`)

레이아웃(2열 그리드 유지):
```
일시 [시작 datetime]    종료 [datetime · 선택]
정원 [        ]
장소 [장소명]           발표자 [        ]
주소 [도로명주소]
```

- 종료 datetime: 기존 `toKstDatetimeLocal` / ISO 변환 로직을 시작과 동일하게 적용. 빈 값이면 null로 제출.
- `starts_at` 처리부(제출 시 `new Date(x).toISOString()`)와 동일 패턴으로 `ends_at` 처리.

## 표시

적용 위치: 이벤트 상세(`src/app/(member)/events/[id]/page.tsx`), 이벤트 목록(`src/app/admin/events/page.tsx`, 멤버 홈 `src/app/(member)/page.tsx` 등 `location`을 렌더하는 곳).

### 시간
- `ends_at` 있고 시작과 **같은 날** → `12:00~16:00` (날짜 1회 + 시간 범위)
- `ends_at` 있고 **다른 날** → 시작 전체 ~ 종료 전체
- `ends_at` 없음 → 시작 일시만 (현행 동일)

포맷 헬퍼는 KST 기준. 기존 날짜 포맷 유틸이 있으면 재사용, 없으면 작은 헬퍼 하나 추가.

### 장소 / 주소
- **장소명**(`location`) 굵게
- **주소**(`address`) 작게 표시 + 그 옆에:
  - **구글맵 링크**: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` (새 탭)
  - **복사 버튼**: `navigator.clipboard.writeText(address)`, 복사 완료 피드백(토스트 또는 버튼 라벨 변경)
- `address`가 빈 값이면 지도/복사 UI 숨김, 장소명만 표시

`ponytail:` 지도는 외부 검색 링크 한 줄. 임베드 지도(iframe/JS SDK)는 필요해지면 그때.

## 범위 밖

- `speaker`, `capacity`, `type` 등 나머지 필드 변경 없음
- 기존 이벤트 description에 이미 적힌 시간/주소 텍스트의 자동 파싱·이전 — 하지 않음(어드민이 필요 시 수동 정리)
- 지도 임베드, 좌표(lat/lng) 저장

## 검증 (구현 후 확인)

- 마이그레이션 적용 → `events` 테이블에 `ends_at`, `address` 존재
- `tests/schemas.test.ts`: `ends_at > starts_at` 검증, `address` 통과 케이스 추가
- 어드민 폼: 종료 없이 저장 / 종료 포함 저장 / 종료 < 시작 시 에러
- 상세 페이지: 같은 날 범위 `12:00~16:00` 표시, 주소 복사·구글맵 링크 동작
