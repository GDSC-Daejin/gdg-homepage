import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("제1세대 포켓몬 카탈로그", () => {
  it("1번 이상해씨부터 151번 뮤까지 이미지 URL을 등록한다", async () => {
    const sql = await readFile("supabase/migrations/0066_pokedex_gen1_catalog.sql", "utf8");

    expect(sql).toContain("with ordinality");
    expect(sql).toContain("'이상해씨'");
    expect(sql).toContain("'뮤'");
    expect(sql).toContain("https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/%s.png");
    expect(sql).toContain("on conflict (pokedex_no) do update");
  });

  it("한글 포켓몬 이름을 올바르게 등록한다", async () => {
    const sql = await readFile("supabase/migrations/0066_pokedex_gen1_catalog.sql", "utf8");

    for (const name of ["뿔충이", "피죤", "피죤투", "주뱃", "골뱃", "날쌩마", "질퍽이", "질뻐기", "텅구리", "뿔카노"]) {
      expect(sql).toContain(`'${name}'`);
    }
  });
});
