import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("도감 포켓몬 결투", () => {
  it("결투를 소유 포켓몬으로만 생성하고 상대만 수락하게 한다", async () => {
    const migration = (await readdir("supabase/migrations")).find((file) => file === "0074_pokedex_duels.sql");
    expect(migration).toBeDefined();
    if (!migration) return;

    const sql = await readFile(`supabase/migrations/${migration}`, "utf8");
    expect(sql).toContain("create table public.pokemon_duels");
    expect(sql).toContain("create function public.pokedex_duel_create");
    expect(sql).toContain("create function public.pokedex_duel_accept");
    expect(sql).toContain("id = v_user and status = 'active'");
    expect(sql).toContain("t.user_id = v_user");
    expect(sql).toContain("d.opponent_id <> v_user");
    expect(sql).toContain("d.status <> 'pending'");
    expect(sql).toContain("grant execute on function public.pokedex_duel_accept");
  });

  it("공식 타입별 공격 연출을 사용한다", async () => {
    const migration = (await readdir("supabase/migrations")).find((file) => file === "0076_pokedex_duel_type_effects.sql");
    expect(migration).toBeDefined();
    if (!migration) return;

    const [sql, panel] = await Promise.all([
      readFile(`supabase/migrations/${migration}`, "utf8"),
      readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8"),
    ]);
    expect(sql).toContain("battle_type");
    expect(sql).toContain("'water'");
    expect(sql).toContain("'flying'");
    expect(panel).toContain("battleEffect(winner.battleType)");
  });

  it("자체 제작 픽셀 캔버스로 물 타입 공격을 충전·발사·명중 순서로 재생한다", async () => {
    const [panel, effect] = await Promise.all([
      readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/PixelBattleEffect.tsx", "utf8"),
    ]);

    expect(panel).toContain("setStage(3)");
    expect(panel).toContain("<PixelBattleEffect");
    expect(panel).toContain("styles.screenShake");
    expect(effect).toContain("<canvas");
    expect(effect).toContain("requestAnimationFrame");
    expect(effect).toContain("const SPRITES");
    expect(effect).toContain("const HIT_SPRITE");
    expect(effect).toContain("water:");
    expect(effect).toContain("FIXED_SPRITE_PATHS");
    expect(effect).toContain('"/pokedex/effects/water.png"');
    expect(effect).toContain('"/pokedex/effects/wind.png"');
    expect(effect).toContain('"/pokedex/effects/grass.png"');
    expect(effect).toContain('"/pokedex/effects/electric.png"');
    expect(effect).toContain("stage === 2");
  });

  it("모든 공식 타입의 고정 이모지 픽셀 스프라이트를 제공한다", async () => {
    const sprites = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "wind", "psychic", "bug", "rock", "ghost", "dragon", "fairy", "steel"];
    const files = await Promise.all(sprites.map((sprite) => readFile(`public/pokedex/effects/${sprite}.png`)));

    expect(files.every((file) => file.length > 100)).toBe(true);
  });

  it("도감에서 결투 탭과 결과 애니메이션을 제공한다", async () => {
    const page = await readFile("src/app/(member)/pokedex/page.tsx", "utf8");
    const panel = await readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8");
    const modal = await readFile("src/components/Modal.tsx", "utf8");

    expect(page).toContain("결투");
    expect(page).toContain("DuelPanel");
    expect(panel).toContain("result && <Modal");
    expect(panel).toContain("if (response.duel) setResult(response.duel)");
    expect(panel).not.toContain("결투 미리보기");
    expect(panel).not.toContain("EFFECT_PREVIEWS");
    expect(panel).toContain("col-start-2 row-start-1");
    expect(panel).toContain("displayName(fighter.name, fighter.nickname)");
    expect(panel).toContain("<Avatar");
    expect(modal).toContain("if (!mounted || !open) return;");
  });
});
