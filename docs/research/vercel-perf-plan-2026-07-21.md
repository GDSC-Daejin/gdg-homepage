# 성능개선 계획 (Vercel React 룰 관점) — 2026-07-21

> **계획서만.** 구현은 Codex. 이 문서는 [codex-perf-res-2026-07-21.md](./codex-perf-res-2026-07-21.md)의 **후속**이다.

## 지금 상태 (중요)

앞선 지시서(codex-perf-res)의 **작업 1~4가 이미 워킹트리에 전부 구현돼 있다. 단, 커밋·실측 전.**

| 작업 | 파일 | 상태 |
|---|---|---|
| 1. Supabase First Load 제거 (동적 import) | `GoogleLoginButton.tsx`, `Avatar.tsx`, `ProfileAvatar.tsx` | ✅ 구현됨 (uncommitted) |
| 2. 폰트 self-host (`next/font/local`) | `fonts.ts`(신규), `layout.tsx`, `globals.css` | ✅ 구현됨 (woff2 파일 존재 확인) |
| 3. Markdown 지연 로드 (`next/dynamic`) | `PostDetailBody.tsx`, `PostForm.tsx` | ✅ 구현됨 |
| 4. orb 페인트 절감 (inset 2겹→1겹, blur 축소) | `Landing.tsx` | ✅ 구현됨 |

**결론: 남은 건 "새 최적화"가 아니라 "이미 한 것의 검증·확정"이 최우선이다.** Vercel 룰 스캔 결과 나머지 큰 레버는 대부분 이미 적용돼 있었다(아래 §참고).

---

## Phase 0 — 이미 된 변경 실측·확정 (최우선, 여기서 대부분 끝)

측정 없는 최적화는 무의미. **프로덕션 빌드 기준**으로만 측정(dev 수치 금지).

1. **회귀 없음**
   ```bash
   pnpm test        # vitest 통과
   pnpm build       # 타입/빌드 통과
   ```
2. **Supabase가 랜딩 First Load에서 빠졌는지**
   ```bash
   PORT=3999 pnpm start &
   sleep 4
   curl -s http://localhost:3999/ | grep -o '/_next/static/chunks/[^"]*\.js' | sort -u
   # 각 청크에서 supabase 시그니처 grep → 0 이어야 목표 달성
   ```
3. **FCP 실측** (브라우저 콘솔, codex-perf-res §검증2 스니펫). 기준선 fcp≈2588ms → **작업1로 <1000ms(로컬) 기대**.
4. **폰트 렌더 확인**: 한글 본문이 Pretendard로 정상 표시. `preload` `<link>`가 `<head>`에 삽입됐는지 확인. (self-host woff2 = `node_modules/pretendard/.../PretendardVariable.woff2` 존재 확인됨)
5. **기능 회귀**: Google 로그인 클릭→OAuth 리다이렉트, 아바타(멤버셸·프로필) 이미지 정상.
6. **커밋** — 명시 경로만 스테이징(같은 워킹트리 다른 세션 가능). **Co-Authored-By 트레일러 넣지 말 것.**

→ 배포 후 3~7일 뒤 Vercel Speed Insights `/`·`/profile` RES 재확인. **목표 90+.** 여기서 목표 달성 시 Phase 1·2는 생략.

---

## Phase 1 — 남은 Vercel 퀵윈 (Phase 0로 부족할 때만)

| 룰 | 대상 | 조치 | 우선 |
|---|---|---|---|
| `bundle-preload` | `GoogleLoginButton.tsx` | 버튼 `onMouseEnter`/`onFocus`에서 `import("@/lib/supabase/client")` 프리페치 → 클릭 지연 체감 제거. 작업1로 First Load에선 뺐으니 클릭 순간 로드 지연만 남음, 이걸 hover로 선로드. | 소 |
| `rendering-script-defer-async` | `layout.tsx` FOUC 테마 스크립트 | **그대로 둔다.** 하이드레이션 전 실행이 목적이라 블로킹이 의도된 정상. (룰 위반 아님 — 확인만) | — |
| `bundle-dynamic-imports` | `Markdown.tsx`(react-markdown+remark 2종) | 이미 소비처 2곳에서 dynamic. 추가 소비처 없는지 `grep -rln "components/Markdown" src/`로 확인, 있으면 동일 처리. | 소 |

> Vercel 스캔에서 **이미 준수 중이라 조치 불필요**로 확인된 항목(아래 §참고)은 재작업하지 말 것.

---

## Phase 2 — 큰 레버 (선택, 리스크 있음 — Phase 0가 RES 90 미달일 때만)

`bundle-analyzable-paths` / Next 16 Cache Components. 현재 `next.config.ts`에 `cacheComponents` 미설정이고 46개 라우트가 `force-dynamic`.

- **공개 정적 페이지**(`about`/`team`/`events` 목록)는 인증과 무관 → `cacheComponents: true` + `use cache`로 사전 렌더 가능. TTFB·서버 렌더 반복 제거.
- **멤버 셸**은 개인화 영역만 `<Suspense>`로 감싸 PPR(정적 셸 + 스트리밍 개인화). auth 데이터 계약은 유지.

**리스크**: 렌더링 모드 전환은 캐시 무효화·개인정보 노출 경계가 걸린다. codex-perf-res §범위밖에서 명시적으로 제외했던 영역이므로, **Phase 0 실측이 목표 미달일 때만** 별도 지시서로 승격해 진행. FCP/LCP 병목은 서버가 아니라 클라JS(작업1)였으므로, 이 Phase가 필요할 가능성은 낮다.

---

## 참고 — Vercel 룰 스캔에서 "이미 준수"로 확인된 것 (재작업 금지)

- `bundle-defer-third-party` ✅ — `AnalyticsProvider`가 `next/script strategy="afterInteractive"` + `NODE_ENV==="production"` gate + `/admin` 제외. GA4/Clarity 하이드레이션 후 로드.
- `bundle-barrel-imports` ✅ — lucide/date-fns/lodash 등 barrel import 없음(grep 0건).
- `server-cache-react` ✅ — `getProfile()`가 `React cache()`로 요청당 dedupe (2026-07-12 감사에서 반영).
- `rendering-hydration-no-flicker` ✅ — 테마 FOUC 인라인 스크립트 존재.
- `loading.tsx` ✅ — `(member)/loading.tsx`·`admin/loading.tsx` 존재.

## 실행 순서 요약

1. **Phase 0** 실측 6단계 → 커밋 → 배포 → RES 재확인 ← **여기서 끝날 것**
2. RES 90 미달 시에만 → Phase 1 퀵윈 → 재측정
3. 그래도 미달 시에만 → Phase 2를 별도 지시서로 승격
