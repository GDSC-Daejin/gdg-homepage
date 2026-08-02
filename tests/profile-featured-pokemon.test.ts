import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("프로필 대표 포켓몬", () => {
  it("보유한 포켓몬만 선택지로 넘긴다", async () => {
    const page = await readFile("src/app/(member)/profile/page.tsx", "utf8");
    const form = await readFile("src/app/(member)/profile/ProfileForm.tsx", "utf8");

    expect(page).toContain('from("pokemon_throws")');
    expect(page).toContain("ownedPokemon");
    expect(form).toContain("대표 포켓몬");
    expect(form).toContain("ownedPokemon.map");
  });

  it("미보유 포켓몬 지정은 DB 함수에서 거절한다", async () => {
    const sql = await readFile("supabase/migrations/0065_profile_featured_pokemon.sql", "utf8");

    expect(sql).toContain("featured_pokemon_id uuid references public.pokemon_catalog(id) on delete set null");
    expect(sql).toContain("create or replace function public.set_featured_pokemon");
    expect(sql).toContain("t.user_id = auth.uid()");
    expect(sql).toContain("t.outcome = 'caught'");
    expect(sql).toContain("revoke execute on function public.set_featured_pokemon(uuid) from public, anon");
  });
});
