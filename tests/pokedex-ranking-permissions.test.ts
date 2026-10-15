import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 랭킹전 내부 RPC 권한", () => {
  it("내부 보조 함수는 외부 역할에서 실행할 수 없고, 일일 배정만 service_role에 허용한다", async () => {
    const sql = await readFile("supabase/migrations/0122_pokedex_ranking_rpc_permissions.sql", "utf8");

    for (const signature of [
      "pokedex_rank_kst_today()",
      "pokedex_rank_type_multiplier(text, text)",
      "pokedex_rank_close_season(uuid)",
      "pokedex_rank_current_season()",
      "pokedex_rank_preset_team(uuid, uuid, text, smallint)",
      "pokedex_rank_allocate_for(uuid, date, uuid)",
    ]) {
      expect(sql).toContain(`revoke execute on function public.${signature} from public, anon, authenticated;`);
    }

    expect(sql).toContain("grant execute on function public.pokedex_rank_refresh_daily() to service_role;");
  });
});
