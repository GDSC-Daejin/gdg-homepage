# 도감 확률표 검색 및 랭킹전 반응형 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포켓몬별 확률표를 이름으로 검색하고, 랭킹전 안내 카드가 태블릿 폭에서도 읽기 쉽게 표시되게 한다.

**Architecture:** `PokedexPage`가 `q` 검색 매개변수를 읽어 서버에서 포켓몬 목록을 필터링한다. 같은 파일의 랭킹전 안내 JSX는 기존 Tailwind 유틸리티만 조정해 카드 열 전환과 문장 줄바꿈을 바꾼다.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Tailwind CSS, Vitest

## Global Constraints

- 새 의존성이나 클라이언트 컴포넌트를 추가하지 않는다.
- `q`는 포켓몬 이름의 부분 일치에만 사용하고, 탭·데이터 조회·접근성 구조는 유지한다.
- 랭킹전의 색상, 탭, 데이터 흐름은 바꾸지 않는다.

---

### Task 1: 검색 폼과 반응형 안내 카드

**Files:**
- Modify: `src/app/(member)/pokedex/page.tsx:38-148`
- Modify: `tests/pokedex-ranking-page.test.ts:29-48`

**Interfaces:**
- Consumes: `searchParams: Promise<{ tab?: string | string[]; q?: string | string[] }>`
- Produces: `q`가 현재 검색어인 GET 폼과 필터링된 포켓몬별 확률표

- [ ] **Step 1: Write the failing test**

```ts
it("확률표에서 포켓몬 이름을 검색한다", async () => {
  mocks.isDemoMode.mockResolvedValue(true);
  const page = await PokedexPage({ searchParams: Promise.resolve({ tab: "probabilities", q: "피카" }) });
  const markup = renderToStaticMarkup(page);

  expect(markup).toContain('name="q"');
  expect(markup).toContain('value="피카"');
  expect(markup).toContain("피카츄");
  expect(markup).not.toContain("꼬부기");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/pokedex-ranking-page.test.ts`

Expected: FAIL because `q` is not rendered or does not filter the probability table.

- [ ] **Step 3: Write minimal implementation**

```tsx
const params = await searchParams;
const query = typeof params.q === "string" ? params.q.trim() : "";
const visiblePokemon = query ? pokemon.filter((pokemon) => pokemon.name_ko.includes(query)) : pokemon;

<form action="/pokedex" className="mb-6 flex gap-2">
  <input type="hidden" name="tab" value="probabilities" />
  <label className="sr-only" htmlFor="pokemon-search">포켓몬 검색</label>
  <input id="pokemon-search" name="q" type="search" defaultValue={query} />
  <Button type="submit">검색</Button>
</form>
```

Import the existing `Button` component. Replace only the final `pokemon.map` probability-table source with `visiblePokemon.map`; when `visiblePokemon` is empty, render `검색한 포켓몬이 없어요.` instead of its table. Change the guide grid to `lg:grid-cols-2`, remove the hard-coded `<br />` elements, and use existing responsive Tailwind typography utilities on guide headings.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/pokedex-ranking-page.test.ts`

Expected: PASS.

- [ ] **Step 5: Check the diff**

Run: `git diff --check && git diff -- src/app/(member)/pokedex/page.tsx tests/pokedex-ranking-page.test.ts`

Expected: only the search form, filtering, responsive card utilities, and tests change.
