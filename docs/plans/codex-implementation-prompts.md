# Codex 구현 프롬프트 모음 (미완 8건)

> 각 프롬프트는 **독립 Codex 세션**에 하나씩 붙여넣는다. 한 세션에서 여러 개를 몰아 실행하지 말 것(diff·리뷰 폭발).
> **패키지 매니저는 pnpm** (npm/yarn 쓰지 말 것).
> 공통 규칙: 저장소 루트 `AGENTS.md`를 먼저 읽는다. Next.js 16이라 학습 데이터와 다를 수 있으니 새 API 사용 전 `node_modules/next/dist/docs/`를 확인한다. 태스크 단위로 커밋하고, 마지막에 `pnpm test`(vitest)와 `pnpm build`가 통과해야 한다.
> **커밋 규칙(중요):** 이 저장소는 같은 워킹트리에 다른 세션의 미커밋 변경이 자주 있다. 커밋은 반드시 `git add <명시 경로>`로 **내가 만든 파일만** — `git add -A`/`git commit -a` 금지. 커밋 메시지에 `Co-Authored-By` 트레일러를 넣지 말 것(훅이 거부). 병렬로 돌릴 땐 각 작업을 **별도 git worktree/브랜치**에서 실행하고 dev로는 하나씩 순차 머지한다.
> **마이그레이션 번호는 사전 배정됨(경쟁 방지):** #4=`0033`, #1=`0034`, #3=`0035`부터. 그 외 작업은 새 마이그레이션 없음. 지정된 번호를 그대로 쓰고 임의로 "다음 번호"를 집지 말 것.

---

## 0. 오케스트레이션 마스터 프롬프트 (Codex 오케스트레이터에 투입)

> 이 프롬프트 하나를 Codex 오케스트레이터에 준다. 오케스트레이터는 **직접 코드를 쓰지 않고 서브에이전트에 위임**한다. 각 서브에이전트에는 아래 1~8절의 해당 프롬프트를 **그대로** 전달한다.

```
너는 gdg-dju 저장소에서 미완 기능 8건의 구현을 오케스트레이션한다. 너는 직접 코드를 쓰지 말고 서브에이전트에 위임해라. 각 작업의 상세 지시는 docs/codex-implementation-prompts.md 의 1~8절에 있고, 각 절은 docs/superpowers/plans|... 의 계획서를 가리킨다. 서브에이전트를 띄울 때 해당 절의 프롬프트 블록을 그대로 전달해라.

[환경]
- 패키지 매니저는 pnpm (npm/yarn 금지).
- **git worktree를 만들지 마라.** 모든 작업은 현재 단일 워킹트리에서 진행한다.
- 이 워킹트리엔 사용자/다른 세션의 미커밋 변경이 이미 섞여 있다. 네가 만든 파일 외에는 절대 건드리지 마라.

[커밋 규칙 — 서브에이전트·오케스트레이터 공통]
- 커밋은 `git add <명시 경로>`로 자기가 만든 파일만. `git add -A` / `git commit -a` 절대 금지.
- 커밋 메시지에 `Co-Authored-By` 트레일러를 넣지 마라(훅이 거부한다).
- 워크트리가 하나뿐이므로 **커밋은 오케스트레이터가 직렬화**한다. 병렬 서브에이전트는 파일 편집까지만 하고, 커밋은 네가 한 작업씩 순서대로 실행하거나, 서브에이전트가 커밋하되 동시에 커밋하지 않도록 직렬화해라.

[마이그레이션 번호 — 사전 배정, 임의 변경 금지]
- #4 포인트상점 = 0033_points_store.sql
- #1 재학여부  = 0034_enrollment_status.sql
- #3 보안      = 0035 부터 순서대로 (계획서의 "0025"는 stale이니 무시)
- 그 외 작업(#2/#5/#6/#7/#8)은 새 마이그레이션 없음.

[그룹 A — 병렬 실행 OK (서로 파일이 안 겹침)]
동시에 서브에이전트로 띄운다. 각자 편집 후, 커밋은 직렬화:
- #2 SEO (layout.tsx + 공개 페이지 + 신규 robots/sitemap/JsonLd)
- #6 이벤트 상세 리디자인 (src/app/(member)/events/[id]/page.tsx — 이미 미커밋 변경 있음, git diff로 이어서)
- #8 홈 리디자인 (src/app/(member)/HomeDashboard.tsx)

[그룹 B — 반드시 이 순서로 순차 실행 (공유 파일·마이그레이션 겹침)]
앞 작업이 커밋 + pnpm test + pnpm build 통과한 뒤에만 다음 작업 시작:
1) #4 포인트상점 (0033)
2) #1 재학여부 (0034)
3) #7 회원 테이블 표면 분리 (admin/members/page.tsx — 이미 미커밋 변경 있음)
4) #5 분석 대시보드 Phase 2
5) #3 보안 (0035~)
겹치는 이유: #4↔#1 = types.ts/schemas.ts/demoData.ts/profile/page.tsx, #1↔#7 = admin/members/page.tsx, #4↔#5 = AdminSidebarNav, #3 = schemas.ts+마이그레이션. 그래서 순서 고정.

[A와 B의 관계]
그룹 A와 그룹 B는 서로 파일이 안 겹치니 동시에 진행해도 된다. 단 커밋 직렬화 원칙은 유지. B 내부 순서만 절대 어기지 마라.

[각 작업 완료 게이트]
서브에이전트가 끝났다고 하면, 너가 직접 `pnpm test` 와 `pnpm build` 를 돌려 초록인지 확인한 뒤 다음(특히 B의 다음 순번)으로 넘어가라. 빨간불이면 같은 서브에이전트에 고치게 하고, 통과 전엔 B의 다음 작업을 시작하지 마라.

[진행 보고]
각 작업의 커밋 해시와 test/build 결과를 한 줄씩 보고해라.
```

---

## 1. 재학 여부 관리 (완전 미착수)

```
gdg-dju 저장소에서 "재학 여부 관리" 기능을 구현해줘.

먼저 docs/superpowers/plans/2026-07-19-enrollment-status.md 를 읽고, 그 계획을 태스크 단위로 순서대로 그대로 실행해. 설계 근거는 docs/superpowers/specs/2026-07-19-enrollment-status-design.md 에 있어.

핵심:
- 상태값은 enrolled / leave_of_absence / graduated 3개만 허용, 기존 행 기본값은 enrolled.
- profiles와 공개 지원서(applications) 양쪽에 독립적으로 저장. 마이그레이션 파일명은 반드시 0034_enrollment_status.sql (사전 배정 번호, 임의로 다른 번호 쓰지 말 것).
- Zod로 서버 입력 검증. 사용자 프로필은 기존 직접 업데이트 권한, 관리자는 기존 admin_update_profile RPC로 저장.
- 사용자 프로필 폼(src/app/(member)/profile), 관리자 회원 관리(src/app/admin/members), 지원 폼/지원서 심사 화면에 입력·수정·표시 반영.

시작 전 AGENTS.md를 읽고, 태스크마다 커밋해. 완료 후 pnpm test 와 pnpm build 통과 확인.
```

---

## 2. SEO / AEO (완전 미착수 · 미확정 값 전부 확정됨)

```
gdg-dju 저장소에서 SEO/AEO를 구현해줘.

docs/seo-aeo-implementation-plan.md 를 읽고 계획대로 태스크 단위로 구현해. 현재 저장소엔 sitemap·robots·JSON-LD가 전혀 없다(from scratch).

미확정 값은 계획서에서 이미 전부 확정됐다(섹션 0.2, 말미 체크리스트 참고). 핵심:
- NEXT_PUBLIC_SITE_URL은 사용자가 .env.local에 이미 실제 도메인으로 넣어둠 → 코드는 process.env로 읽기만, 도메인 하드코딩 금지.
- Organization JSON-LD의 sameAs는 빈 배열 [] 유지(공식 채널 URL 없음, 추후 추가). email 필드 생략.
- FAQ/projects/team 문구는 현재 apply/projects/team 페이지의 실제 내용에서만 가져오고 없는 사실은 창작 금지.

Next.js 16 App Router의 메타데이터/파일 규약을 쓸 것 — 정확한 API 시그니처는 node_modules/next/dist/docs/ 에서 확인하고 쓴다(app/sitemap.ts, app/robots.ts, generateMetadata, structured data 등).

시작 전 AGENTS.md를 읽고, 태스크마다 커밋. 완료 후 pnpm build 로 라우트/메타데이터 생성 확인, pnpm test 통과 확인.
```

---

## 3. 보안 하드닝 (완전 미착수)

```
gdg-dju 저장소에서 보안 하드닝을 구현해줘.

docs/security-hardening-plan.md 를 읽고 계획대로 태스크 단위로 구현해. 현재 rate limit·CSP 등이 없다.

주의:
- 계획서에 없는 범위는 손대지 마. 서버 액션/RLS 동작을 깨지 않도록 기존 인증 경로(src/lib/auth.ts, requireAdmin 등)를 먼저 파악하고 진행.
- 헤더/미들웨어 관련 API는 Next.js 16 기준으로 node_modules/next/dist/docs/ 에서 확인.
- **계획서가 "다음 번호는 0025부터"라고 적었지만 그건 작성 시점 기준이고 이미 0032까지 존재한다. 새 마이그레이션은 0035부터 순서대로(0035, 0036…) 부여할 것.**
- 신규 의존성(Upstash/KV 등)은 도입하지 않는다(계획서에서 기본안으로 확정).

시작 전 AGENTS.md를 읽고, 태스크마다 커밋. 완료 후 pnpm test 와 pnpm build 통과 확인. 리스크가 큰 변경(정책 완화/강제 리다이렉트 등)은 커밋 메시지에 명시.
```

---

## 4. 포인트 상점 — 멤버 소비처 (계획서 작성 완료)

```
gdg-dju 저장소에서 "포인트 상점(멤버가 포인트를 소비하는 화면)"을 구현해줘.

docs/superpowers/plans/2026-07-20-points-store.md 를 읽고 Task 1~9를 순서대로 그대로 실행해. 설계 근거는 docs/superpowers/specs/2026-07-19-points-store-design.md.

주의(계획서 Global Constraints에 있음):
- 마이그레이션은 0033_points_store.sql (0032는 이미 사용 중).
- 잔액은 SUM(point_logs.amount) 그대로 재사용, 새 잔액 컬럼 만들지 말 것.
- 모든 상태 변경은 security definer RPC + for update 잠금으로만. 감사 로깅(log_audit)은 비활성이라 호출 금지.
- 어드민 수동 지급(src/app/admin/points)은 이미 있으니 중복 금지. 서버 액션은 points.ts/budget.ts 골격 그대로.

시작 전 AGENTS.md를 읽고, 태스크마다 커밋. 완료 후 pnpm test 와 pnpm build 통과 확인.
```

---

## 5. 분석 대시보드 — Phase 2만 (Phase 1 계측은 완료됨)

```
gdg-dju 저장소에서 admin 분석 대시보드(Phase 2)를 구현해줘.

docs/superpowers/plans/2026-07-19-analytics-dashboard.md 를 읽어라. Phase 1(동의 배너 + GA4/Clarity 조건부 로딩 + 도메인 이벤트 계측)은 이미 구현되어 있으니 건드리지 마 — src/components/analytics/, src/lib/analytics.ts 존재.

남은 것은 Phase 2뿐:
- lib/ga4.ts (google-auth-library + GA4 Data API REST)로 지표 조회.
- admin에 /admin/analytics 서버 컴포넌트 페이지 추가, 무의존성 SVG/테이블로 렌더. AdminSidebarNav에 진입점 연결.
- google-auth-library 의존성은 이 Phase에서만 추가. 서비스 계정 자격증명은 환경변수로 읽고, 값은 코드/커밋에 넣지 마.

시작 전 AGENTS.md를 읽고 계획서의 Phase 2 태스크를 순서대로 실행, 태스크마다 커밋. 완료 후 pnpm test 와 pnpm build 통과 확인.
```

---

## 6. 멤버 이벤트 상세 리디자인 (미커밋 작업 있음 — 이어서 완성)

```
gdg-dju 저장소에서 멤버 이벤트 상세 리디자인을 마무리해줘.

docs/superpowers/plans/2026-07-19-member-event-detail-redesign.md 가 계획서다. src/app/(member)/events/[id]/page.tsx 에 이미 커밋 안 된 리디자인 변경(+67/−24)이 있으니, 먼저 git diff 로 현재 상태를 확인하고 계획서 대비 남은 부분을 이어서 완성해라.

제약(계획서 그대로):
- 페이지는 async Server Component 유지. EventLocation, NaverMap, RegistrationPanel의 경계·클라이언트 동작 유지.
- 페이지 구성과 유틸 클래스만 변경. 기존 디자인 토큰/컴포넌트 재사용, 패키지·공용 추상화 추가 금지.
- API 호출/URL 처리/접근성 컨트롤/옵셔널 데이터 렌더 보존.

완성 후 하나의 커밋으로 정리. AGENTS.md 확인. pnpm test 와 pnpm build 통과 확인.
```

---

## 7. 멤버 관리 테이블 표면 분리 (미커밋, 거의 완료 — 마무리+커밋)

```
gdg-dju 저장소에서 어드민 회원 관리 테이블 표면 분리를 마무리해줘.

docs/superpowers/plans/2026-07-20-member-table-surface.md 가 계획서다. src/app/admin/members/page.tsx 에 미커밋 변경(+32/−26)이 있으니 git diff 로 확인하고, 계획서의 남은 체크박스를 채워 마무리해라.

제약:
- 필터와 테이블을 별도 시각 표면으로 분리: 컴팩트 필터 카드 1개 + 작은 테이블 헤딩이 있는 테이블 카드 1개(페이지-로컬 Tailwind 래퍼만).
- q/role/status URL 필터, 회원 행 다이얼로그, 링크, 기존 8개 컬럼 보존. MemberFilters/MemberRow 계약 유지, 의존성·컴포넌트 추가 금지. 기존 rounded-xl/gray 토큰/shadow-card 재사용.

완성 후 하나의 커밋으로 정리. AGENTS.md 확인. pnpm test 와 pnpm build 통과 확인.
```

---

## 8. 멤버 홈 리디자인 (미착수 추정)

```
gdg-dju 저장소에서 멤버 홈 리디자인을 구현해줘.

docs/superpowers/plans/2026-07-19-member-home-redesign.md 를 읽고 계획대로 구현해라. 대상은 src/app/(member)/HomeDashboard.tsx 한 파일이다.

제약(계획서 그대로):
- 렌더 구조와 Tailwind 클래스만 변경. HomeDashboard의 기존 Supabase 결과, Link/Card/Badge/StatCard/EmptyState, month 필터를 그대로 재사용. 새 컴포넌트·엔드포인트·의존성 추가 금지.
- 사이드바, 블루 브랜드 컬러, 최신 공지 링크, 이벤트 링크, 설문 링크, 프로필 링크, month URL 필터 보존. 데이터 쿼리와 이벤트 필터링 변경 금지.
- 로그인한 멤버 홈이 다가오는 이벤트를 시각적으로 우선하도록.

주의: HomeDashboard에는 리마인더 배너 등 최근 반영분이 있을 수 있으니 git log/blame으로 현재 상태를 먼저 파악하고, 기존 기능을 깨지 마.

태스크마다 커밋. AGENTS.md 확인. pnpm test 와 pnpm build 통과 확인.
```

---

## 병렬 실행 전략 (충돌 분석 기반)

**8-way 완전 병렬은 금지.** 아래 작업들이 같은 파일/마이그레이션 번호를 건드려 충돌하기 때문:
- 마이그레이션 번호: #4·#1·#3 → **사전 배정으로 해소**(0033/0034/0035).
- 공유 TS 파일: `types.ts·schemas.ts·demoData.ts·errors.ts·profile/page.tsx` → **#4↔#1**.
- `src/app/admin/members/page.tsx` → **#1↔#7**.
- `src/app/admin/AdminSidebarNav.tsx` → **#4↔#5**.
- `schemas.ts`(attendCodeSchema) → **#3**도 살짝 겹침.

### 그룹 A — 병렬 OK (서로 공유 파일 없음)
각각 **별도 worktree/브랜치**에서 동시 실행 후 하나씩 머지:
- **#2 SEO** (layout.tsx + 공개 페이지 + 신규 robots/sitemap/JsonLd)
- **#6 이벤트 상세 리디자인** (events/[id]/page.tsx)
- **#8 홈 리디자인** (HomeDashboard.tsx)

> ⚠️ #6·#7은 지금 워킹트리에 **미커밋 변경**이 있다. 병렬로 worktree를 파기 전에, 이 변경들을 각자 브랜치에 먼저 옮기거나 커밋해 둘 것(안 그러면 worktree가 변경을 못 가져감).

### 그룹 B — 순차 필수 (공유 파일·마이그레이션 겹침)
한 번에 하나씩, dev로 머지하고 다음 것이 그 위에서 시작. 권장 순서:
**#4 포인트상점(0033) → #1 재학여부(0034) → #7 회원테이블 → #5 분석대시보드 → #3 보안(0035~)**

- #4→#1: `types.ts`/`schemas.ts`/`demoData.ts`/`profile/page.tsx`를 순차로 쌓아 충돌 회피.
- #1→#7: 둘 다 `admin/members/page.tsx` → #1(재학 컬럼 표시) 먼저, #7(표면 분리) 그 위에.
- #4→#5: 둘 다 `AdminSidebarNav` → #4 먼저 링크 추가, #5가 이어서.
- #3은 `schemas.ts`·마이그레이션을 건드리니 B의 마지막에.

**요약:** 그룹 A 3개를 병렬로 돌려 빠르게 끝내고, 그룹 B 5개는 순차 파이프라인으로. 이러면 실질 소요는 "가장 긴 A작업" + "B 5개 합"이 되고 머지 충돌은 거의 없다.
