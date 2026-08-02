import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("포켓몬 상세 도감", () => {
  it("포켓몬의 종별 설명을 제공한다", async () => {
    const { pokemonDescription } = await import("@/lib/pokedex/catalog");

    expect(pokemonDescription(7, "꼬부기")).toContain("등딱지");
  });

  it("도감 카드를 상세 경로로 연결한다", async () => {
    const page = await readFile("src/app/(member)/pokedex/page.tsx", "utf8");

    expect(page).toContain("href={`/pokedex/${entry.pokedex_no}`}");
  });

  it("상세 페이지에서 사용 볼과 포획자를 보여준다", async () => {
    const page = await readFile("src/app/(member)/pokedex/[pokedexNo]/page.tsx", "utf8");

    expect(page).toContain('supabase.rpc("pokedex_catchers"');
    expect(page).toContain("내가 사용한 볼");
    expect(page).toContain("포획한 회원");
    expect(page).toContain("전투력");
    expect(page).toContain("<Avatar");
  });

  it("포획자 이름과 프로필 이미지만 제한적으로 조회한다", async () => {
    const [sql, permissions] = await Promise.all([
      readFile("supabase/migrations/0063_pokedex_catchers.sql", "utf8"),
      readFile("supabase/migrations/0064_pokedex_catchers_permissions.sql", "utf8"),
    ]);

    expect(sql).toContain("create or replace function public.pokedex_catchers");
    expect(sql).toContain("avatar_path text");
    expect(sql).toContain("grant execute on function public.pokedex_catchers(uuid) to authenticated");
    expect(permissions).toContain("revoke execute on function public.pokedex_catchers(uuid) from public, anon");
  });
});
