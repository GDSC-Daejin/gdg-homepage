import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { shouldShowDuelPokemon } from "@/app/(member)/pokedex/DuelPanel";

describe("도감 포켓몬 결투", () => {
  it("코인과 선공 안내 중에는 결투 포켓몬을 숨긴다", () => {
    expect(shouldShowDuelPokemon("coin")).toBe(false);
    expect(shouldShowDuelPokemon("firstTurn")).toBe(false);
    expect(shouldShowDuelPokemon("throw")).toBe(false);
    expect(shouldShowDuelPokemon("release")).toBe(true);
  });

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

  it("승인 대기 회원은 결투 상대에서 제외하고 직접 신청도 막는다", async () => {
    const sql = await readFile("supabase/migrations/0094_pokedex_duel_approved_members.sql", "utf8");

    expect(sql).toContain("create or replace function public.pokedex_duel_members");
    expect(sql).toContain("approved_at is not null");
    expect(sql).toContain("create or replace function public.pokedex_duel_create");
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
    expect(panel).toContain("battleEffect(duel.challenger.battleType)");
    expect(panel).toContain("battleEffect(duel.opponent.battleType)");
  });

  it("자체 제작 픽셀 캔버스로 물 타입 공격을 충전·발사·명중 순서로 재생한다", async () => {
    const [panel, effect, styles] = await Promise.all([
      readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/PixelBattleEffect.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/DuelPanel.module.css", "utf8"),
    ]);

    expect(panel).toContain("setStage(3)");
    expect(panel).toContain('"/pokedex/effects/monster-ball.png"');
    expect(panel).toContain('"/pokedex/effects/monster-ball-side.png"');
    expect(panel).toContain("setStage(15)");
    expect(panel).toContain("setStage(2), 1800");
    expect(panel).toContain("몬스터볼이 빛나며 포켓몬이 등장해요!");
    expect(panel).toContain("<PixelBattleEffect");
    expect(panel).toContain("styles.screenShake");
    expect(effect).toContain("<canvas");
    expect(effect).toContain("requestAnimationFrame");
    expect(effect).toContain("const SPRITES");
    expect(effect).toContain("const HIT_SPRITE");
    expect(effect).toContain("water:");
    expect(effect).toContain("FIXED_SPRITE_PATHS");
    expect(effect).toContain('"/pokedex/effects/water.webp"');
    expect(effect).toContain('"/pokedex/effects/wind.webp"');
    expect(effect).toContain('"/pokedex/effects/grass.webp"');
    expect(effect).toContain('"/pokedex/effects/electric.webp"');
    expect(effect).toContain("stage === 2");
    expect(effect).toContain('width="960" height="288"');
    expect(effect).toContain("const battleY = 144");
    expect((await readFile("public/pokedex/effects/monster-ball.png")).length).toBeGreaterThan(100);
    expect(styles).toContain("width: 18px");
    expect(styles).toContain("rotate(-300deg)");
    expect(styles).toContain(".ballRelease::before, .ballRelease::after");
    expect(styles).toContain("release-sparks");
    expect(styles).toContain(".battleArena");
    expect(styles).toContain('url("/pokedex/effects/battle-arena.webp")');
    expect(styles).toContain(".battleFighter");
    expect(styles).toContain("translateY(4rem)");
    expect(styles).toContain("aspect-ratio: 10 / 3");
    expect(styles).toContain("min-height: 18rem");
    expect(panel).toContain('className="max-w-[96rem] p-8"');
    expect(panel).toContain('mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3');
    expect(panel).toContain("styles.facingRight");
    expect(panel).toContain("styles.battleFighter");
    expect(panel).toContain("BattlePokemonSprite");
    expect(panel).toContain("BattleStatus");
    expect(panel).toContain("role=\"progressbar\"");
    expect(panel).toContain("duel.winnerId");
    expect(panel).toContain("styles.battleMessage");
    expect(panel).toContain('crossOrigin="anonymous"');
    expect(styles).toContain(".groundedSprite");
    expect(styles).toContain(".battleMessage");
    expect(styles).toContain(".battleStatus");
    expect(styles).toContain(".healthTrack");
    expect(styles).toContain("clip-path: polygon");
    expect(styles).toContain("pokemon-faint");
    expect(styles).toContain("pokemon-recall");
    expect(styles).toContain("pokemon-capture");
    expect(styles).toContain(".recallLeft");
    expect(styles).toContain(".recallBeam");
    expect(styles).toContain("recall-sparkle");
    expect(styles).toContain("grounded-ball-drop");
    expect(styles).toContain(".groundedBall");
    expect((await readFile("public/pokedex/effects/battle-arena.webp")).length).toBeGreaterThan(10_000);
    expect((await readFile("public/pokedex/effects/monster-ball-side.png")).length).toBeGreaterThan(100);
  });

  it("모든 공식 타입의 고정 이모지 픽셀 스프라이트를 제공한다", async () => {
    const sprites = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "wind", "psychic", "bug", "rock", "ghost", "dragon", "fairy", "steel"];
    const files = await Promise.all(sprites.map((sprite) => readFile(`public/pokedex/effects/${sprite}.webp`)));

    expect(files.every((file) => file.length > 100)).toBe(true);
  });

  it("도감에서 결투 탭과 결과 애니메이션을 제공한다", async () => {
    const [page, panel, admin, modal] = await Promise.all([
      readFile("src/app/(member)/pokedex/page.tsx", "utf8"),
      readFile("src/app/(member)/pokedex/DuelPanel.tsx", "utf8"),
      readFile("src/app/admin/pokedex/page.tsx", "utf8"),
      readFile("src/components/Modal.tsx", "utf8"),
    ]);

    expect(page).toContain("결투");
    expect(page).toContain("PokedexBattleTab");
    expect(panel).toContain("result && <Modal");
    expect(panel).toContain("if (response.duel) setResult(response.duel)");
    expect(admin).toContain("<DuelPreview />");
    expect(panel).not.toContain('aria-label="결투 메뉴"');
    expect(panel).toContain("PREVIEW_DUEL");
    expect(panel).toContain("setPreviewKey");
    expect(panel).toContain("col-start-2 row-start-1");
    expect(panel).toContain("displayName(fighter.name, fighter.nickname)");
    expect(panel).toContain("<Avatar");
    expect(modal).toContain("if (!mounted || !open) return;");
  });

  it("전투력 포획 관계를 단일 객체로 읽어 결투 목록에 전달한다", async () => {
    const page = await readFile("src/app/(member)/pokedex/page.tsx", "utf8");

    expect(page).toContain(".returns<OwnedThrow[]>()");
    expect(page).toContain("const caughtPokemon = throwRecord.pokemon;");
    expect(page).toContain("const combatPower = throwRecord.appearance?.combat_power;");
    expect(page).not.toContain("throwRecord.pokemon[0]");
  });
});
