# 도감 랭킹전 UI 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 랭킹전의 데이터와 동작을 유지한 채, 포켓몬 테마의 시즌 요약·랭킹 패널을 적용한다.

**Architecture:** `RankingLeaguePanel` 안에서 기존 `Card`와 Tailwind 유틸리티를 재조합한다. 리더보드는 기존 순위·이름·점수만 표시하고, 오늘의 상대 카드의 기존 `opponent.lead`만 공개한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest

## Global Constraints

- 기존 디자인 시스템의 `Card`, `Button`, 색상·간격 유틸리티만 사용한다.
- API, 서버 액션, 랭킹 규칙, 접근성 속성, 테스트 셀렉터는 변경하지 않는다.
- 오늘의 상대는 `opponent.lead` 한 마리만 공개하고, 리더보드에 파티 정보를 추가하지 않는다.
- 새 의존성·이미지는 추가하지 않는다.

---

### Task 1: 랭킹전 요약·순위 패널 재배치

**Files:**
- Modify: `src/app/(member)/pokedex/RankingLeaguePanel.tsx:197-205`
- Modify: `tests/pokedex-ranking-panel.test.ts`

**Interfaces:**
- Consumes: `RankingLeagueState.entry`, `RankingLeagueState.leaderboard`, `RankingLeagueState.opponents`
- Produces: 기존 `RankingLeaguePanel({ profileId, state, actions })` 렌더링과 모든 액션 버튼

- [ ] **Step 1: 실패하는 UI 구조 검증을 추가한다**

Visual-only layout changes use the existing panel test and a manual preview; no source-text test is added.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm test tests/pokedex-ranking-panel.test.ts`

Expected: PASS with the existing behavioral assertions.

- [ ] **Step 3: 기존 `Card`와 Tailwind 유틸리티로 최소 레이아웃을 적용한다**

```tsx
<div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
  <Card className="overflow-hidden p-0">...</Card>
  <Card className="overflow-hidden p-0">...</Card>
</div>
```

Keep the existing `opponent.lead` image in the today-opponent card and do not add an image to `state.leaderboard` rows.

- [ ] **Step 4: 관련 테스트가 통과하는지 확인한다**

Run: `pnpm test tests/pokedex-ranking-panel.test.ts`

Expected: PASS.

- [ ] **Step 5: 타입 검사를 실행한다**

Run: `pnpm exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add src/app/(member)/pokedex/RankingLeaguePanel.tsx tests/pokedex-ranking-panel.test.ts
git commit -m "✨ 도감 랭킹전 UI 정비"
```

### Task 2: 초기 포켓몬 등장 순서 보정

**Files:**
- Modify: `src/app/(member)/pokedex/RankingLeaguePanel.tsx:133-140`
- Modify: `tests/pokedex-ranking-panel.test.ts`

**Interfaces:**
- Consumes: `RankingBattleAnimation`의 `phase`, `attackerChanged`, `defenderChanged`
- Produces: 코인·선공 안내·초기 투척에는 숨겨지고 `release`에 처음 렌더링되는 양측 포켓몬 이미지

- [ ] **Step 1: 실패하는 등장 순서 검증을 추가한다**

```ts
it("코인과 선공 안내 중에는 포켓몬을 숨긴다", () => {
  expect(shouldShowRankingPokemon("coin", false)).toBe(false);
  expect(shouldShowRankingPokemon("firstTurn", false)).toBe(false);
  expect(shouldShowRankingPokemon("throw", false)).toBe(false);
  expect(shouldShowRankingPokemon("release", false)).toBe(true);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm test tests/pokedex-ranking-panel.test.ts`

Expected: FAIL because `shouldShowRankingPokemon` is not exported yet.

- [ ] **Step 3: 초기 송출 전용 가드를 추가한다**

```ts
export function shouldShowRankingPokemon(phase: RankingBattlePhase, changed: boolean) {
  return !["coin", "firstTurn", "throw"].includes(phase) && !(phase === "sendoutThrow" && changed);
}

const showAttacker = !attackerRecalled && shouldShowRankingPokemon(phase, attackerChanged);
const showDefender = !defenderRecalled && shouldShowRankingPokemon(phase, defenderChanged);
```

- [ ] **Step 4: 관련 테스트가 통과하는지 확인한다**

Run: `pnpm test tests/pokedex-ranking-panel.test.ts`

Expected: PASS.

### Task 3: 결투 미리보기의 초기 등장 순서 보정

**Files:**
- Modify: `src/app/(member)/pokedex/DuelPanel.tsx:143-198`
- Modify: `tests/pokedex-duels.test.ts`

**Interfaces:**
- Consumes: `DuelAnimation`의 선공 결과와 전투 로그
- Produces: 코인, 선공 안내, 몬스터볼 투척, 발광, 포켓몬 등장 후 전투 로그를 재생하는 결투 미리보기

- [ ] **Step 1: 실패하는 가시성 검증을 추가한다**

```ts
it("코인과 선공 안내 중에는 결투 포켓몬을 숨긴다", () => {
  expect(shouldShowDuelPokemon("coin")).toBe(false);
  expect(shouldShowDuelPokemon("firstTurn")).toBe(false);
  expect(shouldShowDuelPokemon("throw")).toBe(false);
  expect(shouldShowDuelPokemon("release")).toBe(true);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm test tests/pokedex-duels.test.ts`

Expected: FAIL because `shouldShowDuelPokemon` is not exported yet.

- [ ] **Step 3: 결투 시작 단계를 추가한다**

```ts
type DuelIntroPhase = "coin" | "firstTurn" | "throw" | "release" | "battle";

export function shouldShowDuelPokemon(phase: DuelIntroPhase) {
  return phase === "release" || phase === "battle";
}
```

Schedule `coin → firstTurn → throw → release → battle` before advancing `turn` to the first battle-log entry. Reuse the existing monster-ball and release-effect elements.

- [ ] **Step 4: 관련 테스트가 통과하는지 확인한다**

Run: `pnpm test tests/pokedex-duels.test.ts tests/pokedex-ranking-panel.test.ts`

Expected: PASS.

### Task 4: 카드형 프리셋 선택기

**Files:**
- Modify: `src/app/(member)/pokedex/RankingLeaguePanel.tsx`
- Modify: `tests/pokedex-ranking-panel.test.ts`

**Interfaces:**
- Consumes: `RankingLeagueState.ownedPokemon`, `RankingLeagueState.presets`
- Produces: 프리셋 슬롯 드롭다운, 최대 3마리 카드 선택, 기존 저장·방어 활성화 액션

- [ ] **Step 1: 선택 토글의 실패 테스트를 추가한다**

```ts
expect(toggleRankingPresetMember(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
expect(toggleRankingPresetMember(["a", "b"], "c")).toEqual(["a", "b", "c"]);
expect(toggleRankingPresetMember(["a", "b"], "b")).toEqual(["a"]);
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pnpm test tests/pokedex-ranking-panel.test.ts`

Expected: FAIL because `toggleRankingPresetMember` is not exported yet.

- [ ] **Step 3: 카드 선택기와 슬롯 드롭다운을 구현한다**

Keep the existing server save and defense activation actions. A card button shows the existing Pokémon image, name, combat power, and selected state with `aria-pressed`.

- [ ] **Step 4: 관련 테스트와 타입 검사를 실행한다**

Run: `pnpm test tests/pokedex-ranking-panel.test.ts && pnpm exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: 타입 검사를 실행한다**

Run: `pnpm exec tsc --noEmit`

Expected: PASS.

## Self-Review

- Spec coverage: Task 1 covers existing-system-only styling, desktop split layout, responsive stacking, and one-lead disclosure. Task 2 covers the coin-to-release sequence. API and action preservation is enforced by retaining the component interface and current action calls.
- Placeholder scan: no `TBD`, `TODO`, or deferred requirements.
- Type consistency: all fields referenced (`entry`, `leaderboard`, `opponents`, `opponent.lead`) are present in `RankingLeagueState`.
