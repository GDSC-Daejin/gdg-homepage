"use client";

import { useEffect, useRef } from "react";
import type { RankingPokemon } from "@/lib/pokedex/ranking-league";
import type { BattleType } from "@/lib/pokedex/battle-effects";

export type RankingScenePhase = "intro" | "sendout" | "charge" | "attack" | "impact" | "recall" | "result";

const TYPE_COLORS: Record<BattleType, number> = {
  normal: 0xcbd5e1, fire: 0xf97316, water: 0x0ea5e9, electric: 0xfacc15, grass: 0x22c55e,
  ice: 0x67e8f9, fighting: 0xef4444, poison: 0xa855f7, ground: 0xd97706, flying: 0x38bdf8,
  psychic: 0xec4899, bug: 0x84cc16, rock: 0xa16207, ghost: 0x8b5cf6, dragon: 0x6366f1,
  fairy: 0xf472b6, steel: 0x64748b,
};

type Scene = {
  app: import("pixi.js").Application;
  attacker: import("pixi.js").Sprite;
  defender: import("pixi.js").Sprite;
  projectile: import("pixi.js").Graphics;
  impact: import("pixi.js").Graphics;
  phase: RankingScenePhase;
  actor: "attacker" | "defender" | null;
  startedAt: number;
  paused: boolean;
  pausedAt: number | null;
};

export function PixiRankingBattleScene({ attacker, defender, phase, actor, paused, onUnavailable }: {
  attacker: RankingPokemon;
  defender: RankingPokemon;
  phase: RankingScenePhase;
  actor: "attacker" | "defender" | null;
  paused: boolean;
  onUnavailable: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const target = host;
    let cancelled = false;

    async function mount() {
      try {
        const pixi = await import("pixi.js");
        const app = new pixi.Application();
        await app.init({ resizeTo: target, backgroundAlpha: 0, antialias: false, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), preference: "webgl" });
        if (cancelled) return app.destroy(true);
        target.replaceChildren(app.canvas);

        const [attackerTexture, defenderTexture] = await Promise.all([pixi.Assets.load(attacker.imagePath), pixi.Assets.load(defender.imagePath)]);
        if (cancelled) return app.destroy(true);
        const attackerSprite = new pixi.Sprite(attackerTexture);
        const defenderSprite = new pixi.Sprite(defenderTexture);
        const projectile = new pixi.Graphics();
        const impact = new pixi.Graphics();
        for (const sprite of [attackerSprite, defenderSprite]) {
          sprite.anchor.set(0.5);
          sprite.width = 112;
          sprite.height = 112;
          sprite.texture.source.scaleMode = "nearest";
          app.stage.addChild(sprite);
        }
        attackerSprite.scale.x = -1;
        app.stage.addChild(projectile, impact);
        const scene: Scene = { app, attacker: attackerSprite, defender: defenderSprite, projectile, impact, phase, actor, startedAt: performance.now(), paused, pausedAt: paused ? performance.now() : null };
        sceneRef.current = scene;
        app.ticker.add(() => draw(scene));
      } catch {
        onUnavailable();
      }
    }

    void mount();
    return () => {
      cancelled = true;
      const scene = sceneRef.current;
      sceneRef.current = null;
      scene?.app.destroy(true, { children: true });
    };
  // Sprite changes require a new texture; visual state updates are handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attacker.throwId, defender.throwId]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.phase = phase;
    scene.actor = actor;
    scene.startedAt = performance.now();
  }, [phase, actor]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || scene.paused === paused) return;
    const now = performance.now();
    if (paused) scene.pausedAt = now;
    else if (scene.pausedAt) scene.startedAt += now - scene.pausedAt;
    scene.paused = paused;
  }, [paused]);

  function draw(scene: Scene) {
    if (scene.paused) return;
    const { app, attacker: attackerSprite, defender: defenderSprite, projectile, impact } = scene;
    const width = app.screen.width;
    const height = app.screen.height;
    const fromLeft = scene.actor !== "defender";
    const source = fromLeft ? attackerSprite : defenderSprite;
    const target = fromLeft ? defenderSprite : attackerSprite;
    const color = TYPE_COLORS[(fromLeft ? attacker : defender).battleType as BattleType] ?? TYPE_COLORS.normal;
    const elapsed = performance.now() - scene.startedAt;

    attackerSprite.position.set(width * 0.25, height * 0.64);
    defenderSprite.position.set(width * 0.75, height * 0.42);
    attackerSprite.alpha = scene.phase === "recall" && scene.actor === "attacker" ? 0 : 1;
    defenderSprite.alpha = scene.phase === "recall" && scene.actor === "defender" ? 0 : 1;
    projectile.clear();
    impact.clear();
    if (scene.phase === "charge") {
      const pulse = 18 + Math.sin(elapsed / 55) * 6;
      projectile.circle(source.x, source.y - 4, pulse * 2).fill({ color, alpha: 0.18 });
      projectile.circle(source.x, source.y - 4, pulse).fill({ color, alpha: 0.9 });
    }
    if (scene.phase === "attack") {
      const progress = Math.min(elapsed / 420, 1);
      projectile.circle(source.x + (target.x - source.x) * progress, source.y + (target.y - source.y) * progress, 18).fill({ color });
    }
    if (scene.phase === "impact") {
      const progress = Math.min(elapsed / 520, 1);
      impact.circle(target.x, target.y - 4, 18 + progress * 38).fill({ color, alpha: 0.75 - progress * 0.55 });
      impact.circle(target.x, target.y - 4, 14 + progress * 12).fill({ color: 0xffffff, alpha: 0.9 - progress * 0.7 });
      const knockback = Math.max(0, 1 - progress) * 16;
      target.x += target === attackerSprite ? -knockback : knockback;
      target.scale.set(target === attackerSprite ? -1.12 : 1.12, 1.12);
    } else {
      attackerSprite.scale.set(-1, 1);
      defenderSprite.scale.set(1, 1);
    }
  }

  return <div ref={hostRef} className="absolute inset-0" aria-hidden />;
}
