# Pokedex Ranking League Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a season-based, server-resolved 3:3 Pokémon ranking league to the existing Pokédex.

**Architecture:** Keep friendly `pokemon_duels` unchanged. A new migration owns ranking seasons, entries, saved teams, daily opponent allocations, resolved battle snapshots, and idempotent RPCs. The existing `/pokedex` page loads a ranking tab; a small client panel submits only preset and allocation IDs, while the database owns validation, simulation, score changes, and detailed-record privacy.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase PostgreSQL/RPC, Tailwind CSS, Vitest

## Global Constraints

- Do not modify existing friendly-duel tables or RPCs.
- Do not add a dependency or a second battle engine outside PostgreSQL.
- Treat every Server Action argument as untrusted and re-check it in the RPC.
- KST daily reset is 06:00; Vercel cron uses UTC.
- Keep detailed ranking battle logs visible only to their two participants.

---

### Task 1: Persist the ranking league and resolve battles atomically

**Files:**
- Create: `supabase/migrations/0078_pokedex_ranking_league.sql`
- Create: `tests/pokedex-ranking-league.test.ts`

**Interfaces:**
- Produces `pokedex_rank_join()`, `pokedex_rank_save_preset(text, int, uuid[])`, `pokedex_rank_activate_defense(int)`, `pokedex_rank_reroll()`, `pokedex_rank_start_battle(uuid, int)`, `pokedex_rank_state()`, and `pokedex_rank_battle_detail(uuid)`.
- `pokedex_rank_start_battle(allocation_id, attack_preset_slot)` returns one previously persisted battle on retry rather than rolling a new result.

- [ ] **Step 1: Write failing migration contract tests**

```ts
expect(sql).toContain("create table public.pokemon_rank_seasons");
expect(sql).toContain("create table public.pokemon_rank_battles");
expect(sql).toContain("create function public.pokedex_rank_start_battle");
expect(sql).toContain("for update");
expect(sql).toContain("unique (season_id, attacker_id, allocation_id)");
expect(sql).toContain("v_damage := floor((200 + v_attacker_cp * 0.4)");
expect(sql).toContain("v_attacker_delta := 30");
expect(sql).toContain("v_attacker_delta := -30");
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm test tests/pokedex-ranking-league.test.ts`

Expected: FAIL because migration `0078_pokedex_ranking_league.sql` does not exist.

- [ ] **Step 3: Add the minimal database model and RPCs**

Create `pokemon_rank_seasons`, `pokemon_rank_entries`, `pokemon_rank_presets`, `pokemon_rank_preset_members`, `pokemon_rank_allocations`, and `pokemon_rank_battles`. Store battle teams and turn results as JSON snapshots on the battle row. Use a unique battle key per allocation, row locks, and a single `pokedex_rank_start_battle` transaction so retries return the original row. Validate six distinct successful catches, team ownership, three distinct species, and at most one legendary before accepting a preset.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm test tests/pokedex-ranking-league.test.ts`

Expected: PASS.

### Task 2: Refresh daily opponent allocations through a secured cron route

**Files:**
- Create: `src/app/api/cron/pokedex-ranking-daily/route.ts`
- Modify: `vercel.json`
- Modify: `tests/cron-auth.test.ts`
- Create: `tests/pokedex-ranking-daily-cron.test.ts`

**Interfaces:**
- Consumes `pokedex_rank_refresh_daily()` using the service-role Supabase client.
- Produces `GET /api/cron/pokedex-ranking-daily`, scheduled at `0 21 * * *` UTC.

- [ ] **Step 1: Write failing route tests**

```ts
expect((await module.GET(request("Bearer wrong"))).status).toBe(401);
expect(vercel).toContain('"path": "/api/cron/pokedex-ranking-daily"');
expect(vercel).toContain('"schedule": "0 21 * * *"');
```

- [ ] **Step 2: Run focused cron tests to verify they fail**

Run: `pnpm test tests/cron-auth.test.ts tests/pokedex-ranking-daily-cron.test.ts`

Expected: FAIL because the ranking-daily route and cron schedule do not exist.

- [ ] **Step 3: Add the authenticated 06:00 KST refresh route**

Use the existing `hasValidCronAuthorization` and service-role client pattern. Call `pokedex_rank_refresh_daily`; do not post Slack messages or change the existing capture-ranking cron.

- [ ] **Step 4: Run focused cron tests to verify they pass**

Run: `pnpm test tests/cron-auth.test.ts tests/pokedex-ranking-daily-cron.test.ts`

Expected: PASS.

### Task 3: Add typed ranking actions and a focused client panel

**Files:**
- Create: `src/actions/pokedex-ranking.ts`
- Create: `src/lib/pokedex/ranking-league.ts`
- Create: `src/app/(member)/pokedex/RankingLeaguePanel.tsx`
- Modify: `src/lib/errors.ts`
- Create: `tests/pokedex-ranking-actions.test.ts`
- Create: `tests/pokedex-ranking-panel.test.ts`

**Interfaces:**
- `saveRankingPreset(kind: "attack" | "defense", slot: number, throwIds: string[])`
- `activateRankingDefense(slot: number)`
- `rerollRankingOpponents()`
- `startRankingBattle(allocationId: string, attackPresetSlot: number)`
- The panel receives server-loaded ranking state and calls only these actions.

- [ ] **Step 1: Write failing source-contract tests**

```ts
expect(actions).toContain("pokedex_rank_start_battle");
expect(actions).toContain("revalidatePath(\"/pokedex\")");
expect(panel).toContain("방어 프리셋");
expect(panel).toContain("공격 프리셋");
expect(panel).toContain("상대 리롤");
expect(panel).toContain("전투 기록");
```

- [ ] **Step 2: Run focused action and panel tests to verify they fail**

Run: `pnpm test tests/pokedex-ranking-actions.test.ts tests/pokedex-ranking-panel.test.ts`

Expected: FAIL because ranking actions and the panel do not exist.

- [ ] **Step 3: Implement actions, Korean error mapping, and panel**

Use Server Actions only as authenticated RPC adapters. The client panel saves and activates presets, renders public opponent hints, locks re-entry while an action is pending, and opens a modal for an already persisted battle result. Never calculate a winner, score, or random factor in React.

- [ ] **Step 4: Run focused action and panel tests to verify they pass**

Run: `pnpm test tests/pokedex-ranking-actions.test.ts tests/pokedex-ranking-panel.test.ts`

Expected: PASS.

### Task 4: Load ranking state from the Pokédex and expose the ranking tab

**Files:**
- Modify: `src/app/(member)/pokedex/page.tsx`
- Modify: `src/app/(member)/pokedex/DuelPanel.tsx` only if a shared modal component is required
- Modify: `tests/pokedex-duels.test.ts`
- Create: `tests/pokedex-ranking-page.test.ts`

**Interfaces:**
- The server page calls `pokedex_rank_state()` for non-demo users and maps the returned JSON to the types in `ranking-league.ts`.
- `/pokedex?tab=ranking` renders `RankingLeaguePanel` without changing the collection, probability, or friendly-duel paths.

- [ ] **Step 1: Write failing tab and state-loading tests**

```ts
expect(page).toContain('requestedTab === "ranking"');
expect(page).toContain("랭킹전");
expect(page).toContain("pokedex_rank_state");
expect(page).toContain("RankingLeaguePanel");
```

- [ ] **Step 2: Run the focused page tests to verify they fail**

Run: `pnpm test tests/pokedex-ranking-page.test.ts tests/pokedex-duels.test.ts`

Expected: FAIL because the ranking tab is not loaded or rendered.

- [ ] **Step 3: Implement the server-page integration**

Add the new tab and load one ranking-state RPC alongside the existing Pokédex queries. Keep demo mode read-only with a clear empty state rather than fabricating rank mutations.

- [ ] **Step 4: Run focused page tests to verify they pass**

Run: `pnpm test tests/pokedex-ranking-page.test.ts tests/pokedex-duels.test.ts`

Expected: PASS.

### Task 5: Verify the completed feature without touching unrelated work

**Files:**
- Modify only the files created or listed in Tasks 1–4.

- [ ] **Step 1: Run ranking-focused tests**

Run: `pnpm test tests/pokedex-ranking-league.test.ts tests/pokedex-ranking-daily-cron.test.ts tests/pokedex-ranking-actions.test.ts tests/pokedex-ranking-panel.test.ts tests/pokedex-ranking-page.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the frontend typecheck and requested regression tests**

Run: `pnpm typecheck && pnpm test tests/pokedex-duels.test.ts tests/cron-auth.test.ts`

Expected: PASS; do not alter `tests/accessibility-primitives.test.ts`, which is a known unrelated failure.

- [ ] **Step 3: Inspect the scoped diff**

Run: `git diff --check -- docs/superpowers/specs/2026-08-02-pokedex-ranking-league-design.md docs/superpowers/plans/2026-08-02-pokedex-ranking-league.md supabase/migrations/0078_pokedex_ranking_league.sql src/actions/pokedex-ranking.ts src/lib/pokedex/ranking-league.ts src/app/api/cron/pokedex-ranking-daily/route.ts src/app/(member)/pokedex/page.tsx src/app/(member)/pokedex/RankingLeaguePanel.tsx vercel.json tests`

Expected: no whitespace errors and no unrelated file changes.

## Self-review

- Spec coverage: Tasks 1 and 2 cover seasons, preset validation, daily allocation, point safety, idempotent battles, and the 06:00 reset. Tasks 3 and 4 cover member controls, public hints, participant-only detail logs, and existing-page integration.
- Placeholder scan: none.
- Type consistency: all browser mutations use the action names defined in Task 3; all actions call the RPCs defined in Task 1.
