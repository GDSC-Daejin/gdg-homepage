# Codex 구현 프롬프트 모음 (미완 8건)

> 각 프롬프트는 **독립 Codex 세션**에 하나씩 붙여넣는다. 한 세션에서 여러 개를 몰아 실행하지 말 것(diff·리뷰 폭발).
> 공통 규칙: 저장소 루트 `AGENTS.md`를 먼저 읽는다. Next.js 16이라 학습 데이터와 다를 수 있으니 새 API 사용 전 `node_modules/next/dist/docs/`를 확인한다. 태스크 단위로 커밋하고, 마지막에 `npm test`(vitest)와 `npm run build`가 통과해야 한다. 마이그레이션은 `supabase/migrations/`에 다음 번호 `.sql` 파일로 추가만 한다(적용은 사람이 함).

---

## 1. 재학 여부 관리 (완전 미착수)

```
gdg-dju 저장소에서 "재학 여부 관리" 기능을 구현해줘.

먼저 docs/superpowers/plans/2026-07-19-enrollment-status.md 를 읽고, 그 계획을 태스크 단위로 순서대로 그대로 실행해. 설계 근거는 docs/superpowers/specs/2026-07-19-enrollment-status-design.md 에 있어.

핵심:
- 상태값은 enrolled / leave_of_absence / graduated 3개만 허용, 기존 행 기본값은 enrolled.
- profiles와 공개 지원서(applications) 양쪽에 독립적으로 저장. 마이그레이션은 supabase/migrations/ 에 다음 번호 .sql 로 추가.
- Zod로 서버 입력 검증. 사용자 프로필은 기존 직접 업데이트 권한, 관리자는 기존 admin_update_profile RPC로 저장.
- 사용자 프로필 폼(src/app/(member)/profile), 관리자 회원 관리(src/app/admin/members), 지원 폼/지원서 심사 화면에 입력·수정·표시 반영.

시작 전 AGENTS.md를 읽고, 태스크마다 커밋해. 완료 후 npm test 와 npm run build 통과 확인.
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

시작 전 AGENTS.md를 읽고, 태스크마다 커밋. 완료 후 npm run build 로 라우트/메타데이터 생성 확인, npm test 통과 확인.
```

---

## 3. 보안 하드닝 (완전 미착수)

```
gdg-dju 저장소에서 보안 하드닝을 구현해줘.

docs/security-hardening-plan.md 를 읽고 계획대로 태스크 단위로 구현해. 현재 rate limit·CSP 등이 없다.

주의:
- 계획서에 없는 범위는 손대지 마. 서버 액션/RLS 동작을 깨지 않도록 기존 인증 경로(src/lib/auth.ts, requireAdmin 등)를 먼저 파악하고 진행.
- 헤더/미들웨어 관련 API는 Next.js 16 기준으로 node_modules/next/dist/docs/ 에서 확인.

시작 전 AGENTS.md를 읽고, 태스크마다 커밋. 완료 후 npm test 와 npm run build 통과 확인. 리스크가 큰 변경(정책 완화/강제 리다이렉트 등)은 커밋 메시지에 명시.
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

시작 전 AGENTS.md를 읽고, 태스크마다 커밋. 완료 후 npm test 와 npm run build 통과 확인.
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

시작 전 AGENTS.md를 읽고 계획서의 Phase 2 태스크를 순서대로 실행, 태스크마다 커밋. 완료 후 npm test 와 npm run build 통과 확인.
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

완성 후 하나의 커밋으로 정리. AGENTS.md 확인. npm test 와 npm run build 통과 확인.
```

---

## 7. 멤버 관리 테이블 표면 분리 (미커밋, 거의 완료 — 마무리+커밋)

```
gdg-dju 저장소에서 어드민 회원 관리 테이블 표면 분리를 마무리해줘.

docs/superpowers/plans/2026-07-20-member-table-surface.md 가 계획서다. src/app/admin/members/page.tsx 에 미커밋 변경(+32/−26)이 있으니 git diff 로 확인하고, 계획서의 남은 체크박스를 채워 마무리해라.

제약:
- 필터와 테이블을 별도 시각 표면으로 분리: 컴팩트 필터 카드 1개 + 작은 테이블 헤딩이 있는 테이블 카드 1개(페이지-로컬 Tailwind 래퍼만).
- q/role/status URL 필터, 회원 행 다이얼로그, 링크, 기존 8개 컬럼 보존. MemberFilters/MemberRow 계약 유지, 의존성·컴포넌트 추가 금지. 기존 rounded-xl/gray 토큰/shadow-card 재사용.

완성 후 하나의 커밋으로 정리. AGENTS.md 확인. npm test 와 npm run build 통과 확인.
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

태스크마다 커밋. AGENTS.md 확인. npm test 와 npm run build 통과 확인.
```

---

## 실행 순서 권장

독립적이라 순서 강제는 없지만, 충돌 최소화 기준:
1. **6·7** (미커밋분 먼저 커밋해 워킹트리 정리) →
2. **8** (홈), **1** (재학여부) — 멤버/어드민 화면 변경 →
3. **5** (분석 대시보드), **4** (포인트 상점) — 신규 백엔드+화면 →
4. **2** (SEO), **3** (보안) — 설정/인프라, 마지막에.

✅ **8건 전부 "계획서 실행" 프롬프트로 통일됨.** 포인트 상점 계획서(docs/superpowers/plans/2026-07-20-points-store.md) 작성 완료, SEO 미확정 값 전부 확정(계획서 반영). 보안 계획서는 원래 Codex 핸드오프용이라 그대로 실행 가능.
