import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { latestFunction } from "./migration-sql";

describe("도감 랭킹전", () => {
  it("시즌·프리셋·일일 상대·전투 기록을 데이터베이스에서 관리한다", async () => {
    const schema = await readFile("supabase/migrations/0078_pokedex_ranking_league.sql", "utf8");

    for (const table of ["pokemon_rank_seasons", "pokemon_rank_entries", "pokemon_rank_presets", "pokemon_rank_allocations", "pokemon_rank_battles", "pokemon_rank_rewards"]) {
      expect(schema).toContain(`create table public.${table}`);
    }
    expect(schema).toContain("create function public.pokedex_rank_refresh_daily");
    expect(schema).toContain("unique (allocation_id)"); // 배정된 상대 하나에 전투는 한 번뿐
  });

  it("전투는 잠금 안에서 벌어지고 승패는 ±30으로 움직인다", async () => {
    const battle = await latestFunction("pokedex_rank_start_battle");

    expect(battle).toContain("for update");
    expect(battle).toContain("v_damage := floor((200 + v_attacker_cp * 0.4)");
    expect(battle).toContain("v_attacker_delta := 30");
    expect(battle).toContain("v_attacker_delta := -30");
  });

  it("선공을 추첨해 한 쪽씩 번갈아 치는 턴제 전투를 쓴다", async () => {
    const battle = await latestFunction("pokedex_rank_start_battle");

    expect(battle).toContain("v_first_turn_user := case when random() < 0.5 then v_user else a.defender_id end;");
    expect(battle).toContain("v_turn_side := case when v_turn_side = 'attacker' then 'defender' else 'attacker' end;");
    // 한 턴에 치는 쪽은 하나다 — 안 친 쪽의 피해는 0으로 기록된다.
    expect(battle).toContain("'attackerDamage', case when v_turn_side = 'attacker' then v_damage else 0 end");
    expect(battle).toContain("'defenderDamage', case when v_turn_side = 'defender' then v_damage else 0 end");
  });

  it("덱은 서로 다른 3마리에 전설 1마리까지만 담긴다", async () => {
    const preset = await latestFunction("pokedex_rank_save_preset");

    expect(preset).toContain("count(distinct t.pokemon_id)");
    expect(preset).toContain("count(*) filter (where p.rarity = 'legendary')");
    expect(preset).toContain("if v_count <> 3 or v_species <> 3 or v_legendaries > 1 then raise exception 'INVALID_RANKING_TEAM'; end if;");
  });

  it("전투 기록은 당사자만 볼 수 있다", async () => {
    const detail = await latestFunction("pokedex_rank_battle_detail");

    expect(detail).toContain("if b.attacker_id <> v_user and b.defender_id <> v_user then raise exception 'FORBIDDEN'; end if;");
  });
});
