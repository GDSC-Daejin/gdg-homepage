import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("웹 프렌들리숍 몬스터볼 교환", () => {
  it("정책 가격·일일 한도·원자적 지급을 RPC에서 검증한다", async () => {
    const migration = await readFile("supabase/migrations/0121_monster_ball_shop_pricing.sql", "utf8");

    expect(migration).toContain("quantity in (1, 3, 5)");
    expect(migration).toContain("when 1 then 25 when 3 then 70 when 5 then 110");
    expect(migration).toContain("v_daily_quantity + p_quantity > 5");
    expect(migration).toContain("insert into point_logs");
    expect(migration).toContain("insert into pokemon_ball_inventory");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
