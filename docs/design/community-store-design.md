# 설계: 둘러보기(demo) 모드를 seam으로 — Community Store

작성 2026-07-16. 아키텍처 리뷰 후보 1의 그릴링 결과. **구현 전 설계 문서** — 승인된 결정과 남은 갈림길을 기록한다.

## 문제

둘러보기 데이터(`src/lib/demoData.ts`, 24 export)와 Supabase는 이미 두 개의 adapter인데 **seam이 없다**. 대신 `if (demo)` 분기가 **33개 파일에 53회** 인라인돼 있다. 고르는 코드가 곧 호출 코드라, 두 경로가 갈라져도 아무도 모른다.

seam 부재가 만든 실제 결함 두 개:
- **누수** — 데모 쓰기 가드가 admin action 12개에만 있다. 회원 action(`registerForEvent`·`cancelRegistration`·`checkAttendance`·`createPost`·`createComment`·`acceptAnswer`·`submitInquiry`·`submitSurveyResponse`)은 가드가 없어 **둘러보기 중 실제 DB에 쓴다**.
- **불일치** — 데모 쓰기 응답이 대부분 `return {}`(성공 형태)인데 `survey.ts:91`만 `{ error: "둘러보기 모드에서는 저장할 수 없어요" }`.

## 전제 (확정)

둘러보기는 **영구 제품 기능**이다(임시 데모 아님). 따라서 seam이 정답이고 삭제는 배제한다.

## 결정된 설계

### seam 모양 — 집합별 store, 선택 지점 1개

CONTEXT.md의 기록 묶음을 따라 좁은 store 여러 개로 나눈다. adapter 선택은 `getCommunity()` 한 곳에서만 일어나고, 그 결과가 sub-store 묶음을 넘긴다 — 각 interface는 좁고(depth↑), 판정 지점은 여전히 하나다.

위치: `src/lib/community/` — `types.ts`(interface), `supabase.ts`(adapter), `demo.ts`(adapter), `index.ts`(선택 factory).

```ts
// 각 store는 reads(raw 도메인 컬렉션) + ops(원자적 쓰기)로 나뉜다
interface Community {
  members: MemberStore;        // profiles: 필터 조회, setRole/setPosition/setStatus/updateProfile
  applications: ApplicationStore; // 지원서 조회, setStatus/setNote, submitApplication, 모집 설정
  events: EventStore;          // events + registrations + attendances: CRUD, register/cancel,
                               //   checkAttendance, 정원 카운트, 출석 집계 reads
  surveys: SurveyStore;        // surveys + responses + presets
  inquiries: InquiryStore;
  notices: NoticeStore;
  budget: BudgetStore;
  board: BoardStore;           // posts + comments
  points: PointStore;          // point_logs + badges
  audit: AuditStore;           // audit_log reads
}

// 선택은 여기 한 곳 — isDemoMode()가 32개 파일에서 1개로
async function getCommunity(opts?: { client?: SupabaseClient }): Promise<Community> {
  if (opts?.client) return supabaseCommunity(opts.client); // cron: 절대 demo 아님
  if (await isDemoMode()) return demoCommunity;            // ← 유일한 판정 지점
  return supabaseCommunity(await createClient());
}
```

**depth**: 각 op은 한 줄 호출로 RLS 강제 + RPC 원자성 + Supabase→한글 에러 매핑 + 데모 fallback을 산다. `.from`/`.rpc`가 47개 파일 → 2개 adapter 파일로 모인다(locality).

### 두 adapter

- **supabase adapter** — `.from`/`.rpc` + `toKoreanError`를 감싼다. **client를 인자로 받아** cookie-bound(요청)든 service-role(cron)이든 주입 가능. 이는 기존 `computeAttendanceWarnings(supabase)` 주입을 일반화한 것.
- **demo adapter** — `demoData.ts`만으로 뒷받침. `next/*` import 없음. reads는 예시 데이터, ops는 **믿을 만한 성공 형태의 no-op**.

**seam이 진짜인 증거**: demo를 빼도 supabase 쪽에만 adapter 2개(cookie / service-role)가 이미 실재한다. 같은 비즈니스 함수가 셋(cookie·service-role·demo) 다에서 무수정으로 돈다.

### seam이 소유하는 것 vs 남는 것 (deletion test)

| 관심사 | seam 뒤 | 이유 |
|---|---|---|
| `.from` / `.rpc` | 뒤 | data access 본체 |
| RPC 원자성(정원·FIFO·승격·감사) | Postgres에 | adapter는 RPC를 *호출*만, 원자성은 "atomic-or-error" interface 불변식으로 약속 |
| RLS `is_admin()` | 아래(DB) | cookie client가 자동 강제. service-role adapter는 의도적 우회(cron 전용, `CRON_SECRET` 뒤) |
| `toKoreanError` | 뒤 | Supabase 전용, demo엔 불필요 |
| `requireAdmin`/`requireProfile` 리다이렉트 | **action/page에 남음** | `next/navigation` — seam 뒤로 넣으면 `next/headers` 용접 재발 |
| `revalidatePath` | **action에 남음** | Next 캐시, 요청 스코프 |
| zod 검증 | **action에 남음** | 입력 shaping, data access 아님 |
| 페이지 집계(대시보드·설문 결과) | **page에 남음** | 같은 shaping이 demo/real 둘 다에 돎. seam은 raw 컬렉션 반환, page가 shape |

### 데모 쓰기 시맨틱 (D1 확정)

**성공 형태의 no-op, 절대 에러 없음.** 반환값은 실제 성공 shape와 맞춘다(예: `registerForEvent` → `{ status: "confirmed" }`, 빈 `{}`가 아님 — caller가 `.status`를 읽음). `survey.ts:91`의 에러 반환은 이 규칙에 맞춰 합성 `SurveyPreset` 반환으로 고친다.
근거: 둘러보기는 영구 가이드 투어 — 투어 중 에러 토스트는 결함.

## 살아남는 테스트

demo adapter가 곧 test fake. `next/*` 목킹 불필요(현재 테스트 0개가 `demoData.ts`를 import).

```ts
// 실제 비즈니스 계산(50% 임계 필터)을 DB·next/* 없이
test("출석률 임계 미만 활동 회원을 표시", async () => {
  const warnings = await computeAttendanceWarnings(demoCommunity.events); // reads 주입
  expect(warnings.every((w) => w.rate < ATTENDANCE_WARNING_THRESHOLD)).toBe(true);
});

// 누수 수정 검증
test("데모에서 회원 쓰기는 믿을 만한 no-op", async () => {
  expect(await demoCommunity.events.register("demo-e1")).toEqual({ status: "confirmed" });
});
```

**여전히 못 테스트**: PL/pgSQL RPC 본문(정원·FIFO·승격·감사)은 vitest에 안 보인다 — DB 통합 테스트/pgTAP 영역. seam은 *계약*을 테스트하지 *메커니즘*은 못 함.

## 마이그레이션 경로

**파일 단위 점진 적용.** 53개 분기가 각각 독립 — 미전환 페이지는 인라인 `if (!demo)` 유지, 전환 페이지는 store 사용. big-bang 아님.

1. **첫 슬라이스(추천)**: 출석 경고 경로 — `attendance-stats.ts` + `attendance-warning.ts` + `cron/route.ts`(~3파일). 이미 주입 seam 존재(변환 최소), cookie·service-role 둘 다 태워 adapter 2개 증명, 읽기 전용(위험 없음), 첫 무목킹 회귀 테스트 산출.
2. **누수 수정 슬라이스**(behavior change — 별도 리뷰): `registration`·`attendance`·`post`·`inquiry`·`survey:submitSurveyResponse`.
3. **순수 리팩터**: 이미 가드된 admin action 12개 파일.
4. **읽기 페이지 20개.**

**`next/headers` 용접 해소**: interface·demo adapter는 `next/*` import 없음 → 주입받는 모듈(`computeAttendanceWarnings(reads)`)은 요청 컨텍스트 밖에서 import·테스트 가능. 여전히 못 하는 것: 인자 없는 `getCommunity()`(`isDemoMode()`→`cookies()`)와 `createClient()` — store를 *구성*하는 최상단 action/page는 요청 컨텍스트에 남음(`revalidatePath`/`redirect`가 어차피 요구).

## 남은 갈림길 (구현 시 확정)

- **D3 — demo 읽기 필터 재현?** 현재 `admin/members/page.tsx`는 real 경로만 `q/role/status` 필터, demo는 `DEMO_MEMBERS` 무필터. **초기엔 무필터 유지**(현행 보존, 최소 변경), interface 문서에 "demo 읽기는 필터 무시 가능" 명시. 더 그럴듯한 투어는 나중.
- **D4 — 읽기 정렬은 계약인가?** `members`는 `joined_at desc` 의존. **정렬은 계약으로** — demo 데이터를 미리 정렬해 real과 안 갈리게. 비용 낮음(정적 데이터).
- **D5 — 런타임 선택 유지.** 쿠키 기반 per-request/per-user 토글이라 컴파일타임 스왑 불가. 현행 유지.

## 참조 파일

`src/lib/{demo,demoData,attendance-stats,auth}.ts`, `src/lib/supabase/server.ts`, `src/actions/{member,registration,attendance,post,inquiry,survey,points,attendance-warning}.ts`, `src/app/admin/members/page.tsx`, `src/app/admin/surveys/[id]/results/page.tsx`, `src/app/api/cron/attendance-warning/route.ts`.
