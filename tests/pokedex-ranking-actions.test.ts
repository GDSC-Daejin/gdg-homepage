import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 랭킹전 액션", () => {
  it("서버 액션은 랭킹 RPC만 호출하고 도감 화면을 갱신한다", async () => {
    const actions = await readFile("src/actions/pokedex-ranking.ts", "utf8").catch(() => "");
    expect(actions).toContain("pokedex_rank_join");
    expect(actions).toContain("pokedex_rank_save_preset");
    expect(actions).toContain("pokedex_rank_start_battle");
    expect(actions).toContain('revalidatePath("/pokedex")');
  });
});
