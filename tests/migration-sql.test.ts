import { describe, expect, it } from "vitest";
import { latestFunction } from "./migration-sql";

describe("마이그레이션 함수 조회", () => {
  it("가장 나중에 덮어쓴 정의를 돌려준다", async () => {
    const state = await latestFunction("pokedex_rank_state");
    // activeAttackSlot은 0085에만 있다. 0078·0083·0084를 집으면 없다.
    expect(state).toContain("'activeAttackSlot', active_attack_slot");

    const battle = await latestFunction("pokedex_rank_start_battle");
    // 선공 추첨은 0082에만 있다. 0078·0080을 집으면 없다.
    expect(battle).toContain("v_first_turn_user :=");
  });

  it("함수 하나의 본문만 잘라낸다", async () => {
    const today = await latestFunction("pokedex_rank_kst_today");

    expect(today.startsWith("create function public.pokedex_rank_kst_today(")).toBe(true);
    expect(today.endsWith("$$;")).toBe(true);
    expect(today).not.toContain("pokedex_rank_type_multiplier"); // 바로 뒤 함수까지 삼키지 않는다
  });

  it("없는 함수는 조용히 빈 문자열이 되지 않고 실패한다", async () => {
    await expect(latestFunction("pokedex_rank_nonexistent")).rejects.toThrow("정의가 없다");
  });
});
