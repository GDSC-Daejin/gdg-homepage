import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { latestFunction } from "./migration-sql";

// 2026-10-16 베타 점검에서 찾은 막힘을 다시 만들지 않도록 살아있는 정의를 검사한다.
describe("랭킹전 베타 수정", () => {
  it("새 전투는 FOUND가 아니라 할당 행으로 존재 여부를 본다", async () => {
    const battle = await latestFunction("pokedex_rank_start_battle");

    // 두 번째 v_existing 조회가 FOUND를 false로 덮어써 새 전투가 전부 거절됐다.
    expect(battle).not.toContain("if not found or a.season_id");
    expect(battle).toContain("if a.id is null or a.season_id <> v_season");
  });

  it("전투 시작 결과에 재생 화면이 쓰는 양측 팀과 당사자 id가 들어 있다", async () => {
    const battle = await latestFunction("pokedex_rank_start_battle");
    const returns = battle.match(/return jsonb_build_object\([^;]*\);/g) ?? [];

    expect(returns).toHaveLength(3); // 새로고침 재시도 2곳 + 새 전투
    for (const value of returns) {
      for (const key of ["'attackerId'", "'defenderId'", "'attackerTeam'", "'defenderTeam'", "'battleLog'", "'winnerId'", "'createdAt'"]) {
        expect(value).toContain(key);
      }
    }
  });

  it("상대·공격 횟수·리롤은 KST 06:00에 바뀌는 같은 게임일로 센다", async () => {
    const [gameDay, today, battle, reroll, state] = await Promise.all([
      latestFunction("pokedex_rank_game_day"),
      latestFunction("pokedex_rank_kst_today"),
      latestFunction("pokedex_rank_start_battle"),
      latestFunction("pokedex_rank_reroll"),
      latestFunction("pokedex_rank_state"),
    ]);

    expect(gameDay).toContain("- interval '6 hours'");
    expect(today).toContain("pokedex_rank_game_day(now())");
    for (const body of [battle, reroll, state]) {
      expect(body).not.toContain("at time zone 'Asia/Seoul')::date = v_today");
    }
    expect(battle).toContain("pokedex_rank_game_day(created_at) = v_today");
    expect(state).toContain("pokedex_rank_game_day(b.created_at) = v_today");
  });

  it("동시 조회가 겹쳐도 배정은 공격자별로 줄 서고 중복 키로 실패하지 않는다", async () => {
    const allocate = await latestFunction("pokedex_rank_allocate_for");

    expect(allocate).toContain("pg_advisory_xact_lock(hashtext('rank-attacker:'");
    expect(allocate).toContain("on conflict (season_id, allocated_on, attacker_id, defender_id) do nothing;");
    expect(allocate).toContain("if found then v_count := v_count + 1; end if;");
  });

  it("새 상대가 없으면 리롤을 거절해 기존 상대를 지킨다", async () => {
    const [reroll, errors] = await Promise.all([latestFunction("pokedex_rank_reroll"), readFile("src/lib/errors.ts", "utf8")]);

    expect(reroll).toContain("if pokedex_rank_allocate_for(v_season, v_today, v_user) = 0 then raise exception 'RANKING_REROLL_NO_CANDIDATES'; end if;");
    expect(errors).toContain("RANKING_REROLL_NO_CANDIDATES:");
  });

  it("보조 함수는 PostgREST에서 직접 부를 수 없다", async () => {
    const sql = await readFile("supabase/migrations/0126_pokedex_ranking_beta_fixes.sql", "utf8");

    expect(sql).toContain("revoke execute on function public.pokedex_rank_game_day(timestamptz) from public, anon, authenticated;");
    expect(sql).toContain("revoke execute on function public.pokedex_rank_kst_today() from public, anon, authenticated;");
    expect(sql).toContain("revoke execute on function public.pokedex_rank_allocate_for(uuid, date, uuid) from public, anon, authenticated;");
  });

  it("사이드바 랭킹전은 /pokedex/ranking으로 가고, 예전 /ranking 주소는 오픈 뒤 그쪽으로 보낸다", async () => {
    const [nav, page] = await Promise.all([
      readFile("src/app/(member)/SidebarNav.tsx", "utf8"),
      readFile("src/app/ranking/page.tsx", "utf8"),
    ]);

    expect(nav).toContain('{ href: "/pokedex/ranking", label: "랭킹전", icon: "ranking" }');
    expect(nav).toContain('excludePrefixes: ["/pokedex/ranking"]');
    expect(page).toContain('if (isRankingLeagueOpen()) redirect("/pokedex/ranking");');
  });
});
