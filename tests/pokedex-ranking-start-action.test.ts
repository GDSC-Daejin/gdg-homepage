import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireProfile: vi.fn(async () => ({ id: "me" })) }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn(async () => false) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc })) }));

const { startRankingBattle } = await import("@/actions/pokedex-ranking");

describe("랭킹전 공격 시작 액션", () => {
  beforeEach(() => rpc.mockReset());

  it("시작 RPC 요약 대신 양측 팀이 들어 있는 전투 상세를 돌려준다", async () => {
    const detail = { id: "b1", attackerId: "me", defenderId: "d", attackerTeam: [{ name: "a" }], defenderTeam: [{ name: "d" }], battleLog: [] };
    rpc.mockResolvedValueOnce({ data: { id: "b1", winnerId: "me", battleLog: [] }, error: null }).mockResolvedValueOnce({ data: detail, error: null });

    const result = await startRankingBattle("allocation", 1);

    expect(rpc).toHaveBeenNthCalledWith(1, "pokedex_rank_start_battle", { p_allocation: "allocation", p_attack_slot: 1 });
    expect(rpc).toHaveBeenNthCalledWith(2, "pokedex_rank_battle_detail", { p_battle: "b1" });
    expect(result).toEqual({ battle: detail });
  });

  it("상세 조회가 실패하면 오류 문구를 돌려주고 깨진 전투를 넘기지 않는다", async () => {
    rpc.mockResolvedValueOnce({ data: { id: "b1" }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const result = await startRankingBattle("allocation", 1);

    expect(result.battle).toBeUndefined();
    expect(result.error).toContain("기록 탭");
  });

  it("시작 RPC 오류는 그대로 한국어 문구로 바꿔 돌려준다", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "RANKING_BATTLE_UNAVAILABLE" } });

    const result = await startRankingBattle("allocation", 1);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result.error).toBe("지금은 이 상대에게 결투할 수 없어요");
  });
});
