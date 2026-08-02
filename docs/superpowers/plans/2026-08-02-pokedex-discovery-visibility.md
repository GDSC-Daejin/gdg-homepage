# Pokedex Discovery Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reveal each Pokémon's image and description only after the current member has caught it, while keeping probability-table names visible.

**Architecture:** Reuse each server page's existing successful-throw query. The list page derives a per-row caught boolean from `countByPokemon`; the detail page derives it from `myCatches.length`. No API or schema changes are needed.

**Tech Stack:** Next.js App Router, TypeScript, React Server Components, Tailwind CSS, Vitest

## Global Constraints

- Preserve existing probability values and detail-page content unrelated to discovery visibility.
- Do not modify the existing uncommitted combat-power changes in the detail page.
- Add no dependency, API, schema, or reusable abstraction.

---

### Task 1: Gate unknown Pokémon visuals in the probability table and detail page

**Files:**
- Modify: `src/app/(member)/pokedex/page.tsx`
- Modify: `src/app/(member)/pokedex/[pokedexNo]/page.tsx`
- Modify: `tests/pokedex-probabilities-page.test.ts`
- Modify: `tests/pokedex-detail.test.ts`

**Interfaces:**
- Consumes: `countByPokemon: Map<string, number>` and `myCatches: Catch[]`, both already built from the current member's successful throws.
- Produces: `caught` booleans used only by existing image and text elements.

- [ ] **Step 1: Write failing source-contract tests**

```ts
expect(page).toContain('const caught = (countByPokemon.get(entry.id) ?? 0) > 0;');
expect(page).toContain('alt={caught ? entry.name_ko : "미획득 포켓몬"}');
expect(page).toContain('const caught = myCatches.length > 0;');
expect(page).toContain('{caught ? pokemonDescription(pokemon.pokedex_no, pokemon.name_ko) : "???"}');
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `pnpm test tests/pokedex-probabilities-page.test.ts tests/pokedex-detail.test.ts`

Expected: FAIL because the caught booleans and hidden detail description do not exist.

- [ ] **Step 3: Implement the minimal visibility gates**

```tsx
const caught = (countByPokemon.get(entry.id) ?? 0) > 0;
<img alt={caught ? entry.name_ko : "미획득 포켓몬"} className={`h-9 w-9 object-contain ${caught ? "" : "grayscale brightness-0 opacity-45"}`} />

const caught = myCatches.length > 0;
<p>{caught ? pokemonDescription(pokemon.pokedex_no, pokemon.name_ko) : "???"}</p>
```

Leave the probability-table name as `{entry.name_ko}` and keep the detail title as the existing Pokémon name.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `pnpm test tests/pokedex-probabilities-page.test.ts tests/pokedex-detail.test.ts && pnpm typecheck`

Expected: PASS, with the known unrelated accessibility-primitives failure excluded.

- [ ] **Step 5: Review only the requested diff and commit**

Run: `git diff --check -- src/app/(member)/pokedex/page.tsx src/app/(member)/pokedex/[pokedexNo]/page.tsx tests/pokedex-probabilities-page.test.ts tests/pokedex-detail.test.ts`

Commit only the four files above, leaving pre-existing combat-power changes unstaged.

## Self-review

- Spec coverage: Task 1 covers probability-table names, conditional silhouettes, and conditional detail descriptions; existing collection behavior remains untouched.
- Placeholder scan: none.
- Type consistency: both `caught` values are local booleans derived from existing types.
