"use client";

import { useEffect, useRef } from "react";
import type { BattleType } from "@/lib/pokedex/battle-effects";

type Palette = readonly [dark: string, main: string, light: string, sparkle: string];

const PALETTES: Record<BattleType, Palette> = {
  normal: ["#64748b", "#cbd5e1", "#f8fafc", "#ffffff"], fire: ["#b91c1c", "#f97316", "#fef08a", "#fff7ed"], water: ["#0369a1", "#0ea5e9", "#e0f2fe", "#ffffff"], electric: ["#ca8a04", "#facc15", "#fef9c3", "#ffffff"], grass: ["#15803d", "#22c55e", "#dcfce7", "#ffffff"], ice: ["#0891b2", "#67e8f9", "#ecfeff", "#ffffff"], fighting: ["#b91c1c", "#ef4444", "#fee2e2", "#ffffff"], poison: ["#7e22ce", "#a855f7", "#f3e8ff", "#ffffff"], ground: ["#92400e", "#d97706", "#fef3c7", "#ffffff"], flying: ["#0284c7", "#38bdf8", "#e0f2fe", "#ffffff"], psychic: ["#be185d", "#ec4899", "#fce7f3", "#ffffff"], bug: ["#4d7c0f", "#84cc16", "#ecfccb", "#ffffff"], rock: ["#713f12", "#a16207", "#fef3c7", "#ffffff"], ghost: ["#5b21b6", "#8b5cf6", "#ede9fe", "#ffffff"], dragon: ["#4338ca", "#6366f1", "#e0e7ff", "#ffffff"], fairy: ["#be185d", "#f472b6", "#fce7f3", "#ffffff"], steel: ["#334155", "#64748b", "#f8fafc", "#ffffff"],
};

const SPRITES: Record<BattleType, readonly string[]> = {
  normal: ["000222000", "022222220", "022343220", "223333322", "223333322", "022343220", "022222220", "000222000"],
  fire: ["000040000", "000343000", "003323000", "003232200", "002222200", "022222220", "002212000", "000110000"],
  water: ["000000000000000000000000", "000000000000000000000400", "000000000000000000004340", "000000000000000000043234", "000000000000000000432234", "000000000000000004322234", "000000000000000043222234", "000000000000000432222234", "000000000000004322220000", "000000000000043222234000", "000000000000432222223400", "000000000004322222223400", "000000000043222222223000", "000000000432222222222000", "000000004322222222222100", "000000043222222222221100", "000000432222222222211000", "000004322222222222110000", "000043222222222211100000", "000432222222221110000000"],
  electric: ["000044000", "000340000", "003300000", "002340000", "000332000", "000023000", "000230000", "002200000"],
  grass: ["000040000", "000342000", "003222000", "002223000", "022222300", "012222200", "001222100", "000111000"],
  ice: ["000040000", "000343000", "040232040", "003222300", "222222222", "003222300", "040232040", "000110000"],
  fighting: ["000000000", "002220000", "022232200", "022222220", "022222220", "002222200", "000222000", "000110000"],
  poison: ["000040000", "000343000", "003333000", "022222200", "022222200", "002222000", "000110000", "000000000"],
  ground: ["000000000", "000040000", "000343000", "002222000", "022222220", "122222221", "011222110", "000111000"],
  flying: ["000000000", "000004000", "003333400", "022222230", "001222220", "000122210", "000011100", "000000000"],
  psychic: ["000040000", "003343000", "032223000", "022022200", "022022200", "032223000", "003333000", "000110000"],
  bug: ["000000000", "003443000", "022322200", "022222200", "002222000", "012222100", "001221000", "000110000"],
  rock: ["000000000", "000343000", "003222300", "022222220", "022222220", "012222210", "001221100", "000110000"],
  ghost: ["000040000", "003343000", "022222200", "022222200", "022222200", "022022200", "012102100", "001001000"],
  dragon: ["000004000", "000343000", "003222200", "022222220", "022232220", "012222210", "001221100", "000110000"],
  fairy: ["000040000", "000343000", "043223400", "022222220", "002222200", "024242000", "002222000", "000110000"],
  steel: ["000040000", "003343000", "032223000", "022222200", "022222200", "003222000", "000110000", "000000000"],
};

const HIT_SPRITE = ["0004000", "0043400", "0432340", "4321234", "0432340", "0043400", "0004000"];

const FIXED_SPRITE_PATHS: Partial<Record<BattleType, string>> = {
  normal: "/pokedex/effects/normal.webp",
  fire: "/pokedex/effects/fire.webp",
  flying: "/pokedex/effects/wind.webp",
  water: "/pokedex/effects/water.webp",
  grass: "/pokedex/effects/grass.webp",
  electric: "/pokedex/effects/electric.webp",
  ice: "/pokedex/effects/ice.webp",
  fighting: "/pokedex/effects/fighting.webp",
  poison: "/pokedex/effects/poison.webp",
  ground: "/pokedex/effects/ground.webp",
  psychic: "/pokedex/effects/psychic.webp",
  bug: "/pokedex/effects/bug.webp",
  rock: "/pokedex/effects/rock.webp",
  ghost: "/pokedex/effects/ghost.webp",
  dragon: "/pokedex/effects/dragon.webp",
  fairy: "/pokedex/effects/fairy.webp",
  steel: "/pokedex/effects/steel.webp",
};

let waterEmojiCache: HTMLCanvasElement | undefined;

function waterEmojiSprite() {
  if (waterEmojiCache) return waterEmojiCache;
  const sprite = document.createElement("canvas");
  sprite.width = 24;
  sprite.height = 24;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  context.font = '22px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  context.textBaseline = "top";
  context.fillText("🌊", 0, -1);
  waterEmojiCache = sprite;
  return sprite;
}

function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), size, size);
}

function sprite(ctx: CanvasRenderingContext2D, pixels: readonly string[], x: number, y: number, scale: number, palette: Palette, direction = 1, tick = 0) {
  pixels.forEach((row, rowIndex) => [...row].forEach((color, columnIndex) => {
    if (color === "0") return;
    const paletteIndex = Number(color) - 1;
    const shimmer = color === "3" && tick % 5 === 0 ? palette[3] : palette[paletteIndex];
    const xOffset = direction === 1 ? columnIndex : row.length - 1 - columnIndex;
    block(ctx, x + xOffset * scale, y + rowIndex * scale, scale, shimmer);
  }));
}

function fixedSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, direction: number, size: number) {
  if (!image.complete || !image.naturalWidth) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}

function projectile(ctx: CanvasRenderingContext2D, type: BattleType, x: number, y: number, direction: number, palette: Palette, tick: number, image?: HTMLImageElement) {
  const spriteDirection = type === "water" ? -direction : direction;
  if (image && fixedSprite(ctx, image, x, y, spriteDirection, 36)) {
    const trailLength = type === "water" ? 5 : 4;
    for (let index = 0; index < trailLength; index++) block(ctx, x - direction * (16 + index * 5), y + (index % 2 ? 4 : -3), 2, index % 2 ? palette[2] : palette[3]);
    return;
  }
  if (type === "water") {
    const wave = waterEmojiSprite();
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-direction, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(wave, -18, -18, 36, 36);
    ctx.restore();
    for (let index = 0; index < 5; index++) block(ctx, x - direction * (16 + index * 5), y + (index % 2 ? 4 : -3), 2, index % 2 ? palette[2] : palette[3]);
    return;
  }
  const pixels = SPRITES[type];
  sprite(ctx, pixels, x - Math.floor(pixels[0].length), y - Math.floor(pixels.length), 2, palette, direction, tick);
  for (let index = 0; index < 4; index++) block(ctx, x - direction * (14 + index * 5), y + ((index + tick) % 3 - 1) * 3, 2, index % 2 ? palette[1] : palette[2]);
}

function charge(ctx: CanvasRenderingContext2D, type: BattleType, x: number, y: number, palette: Palette, tick: number, image?: HTMLImageElement) {
  const radius = 13 + tick % 5;
  for (let index = 0; index < 14; index++) {
    const angle = index / 14 * Math.PI * 2 + tick / 14;
    block(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, index % 4 === 0 ? 3 : 2, index % 4 === 0 ? palette[3] : index % 2 ? palette[1] : palette[2]);
  }
  block(ctx, x - 5, y - 5, 10, palette[0]);
  block(ctx, x - 3, y - 3, 6, palette[1]);
  block(ctx, x - 1, y - 1, 3, palette[3]);
  if (!image || !fixedSprite(ctx, image, x, y, 1, 18)) {
    const pixels = SPRITES[type];
    sprite(ctx, pixels, x - Math.floor(pixels[0].length / 2), y - Math.floor(pixels.length / 2), 1, palette, 1, tick);
  }
}

function hit(ctx: CanvasRenderingContext2D, x: number, y: number, palette: Palette, tick: number) {
  const radius = 11 + tick % 4;
  for (let index = 0; index < 18; index++) {
    const angle = index / 18 * Math.PI * 2 + tick / 16;
    block(ctx, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, index % 4 === 0 ? 3 : 2, index % 4 === 0 ? palette[3] : index % 2 ? palette[1] : palette[2]);
  }
  sprite(ctx, HIT_SPRITE, x - 7, y - 7, 2, palette, 1, tick);
}

export function PixelBattleEffect({ type, stage, fromLeft, className }: { type: BattleType; stage: number; fromLeft: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.imageSmoothingEnabled = false;
    const palette = PALETTES[type];
    const direction = fromLeft ? 1 : -1;
    const sourceX = fromLeft ? 195 : 765;
    const targetX = fromLeft ? 765 : 195;
    const battleY = 144;
    const start = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spritePath = FIXED_SPRITE_PATHS[type];
    const fixedImage = spritePath ? new Image() : undefined;
    let frame = 0;
    let cancelled = false;

    const draw = (now: number) => {
      const tick = Math.floor((now - start) / 55);
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (stage === 0) charge(context, type, sourceX, battleY, palette, tick, fixedImage);
      if (stage === 1) {
        const progress = Math.min((now - start) / 620, 1);
        const x = sourceX + (targetX - sourceX) * progress;
        for (let index = 0; index < 8; index++) {
          const trail = Math.max(progress - index * .08, 0);
          block(context, sourceX + (targetX - sourceX) * trail, battleY + Math.sin(index + tick / 3) * 3, 3, index % 3 === 0 ? palette[2] : palette[1]);
        }
        projectile(context, type, x, battleY, direction, palette, tick, fixedImage);
      }
      if (stage === 2) hit(context, targetX, battleY, palette, tick);
      if (!reduceMotion && stage < 3) frame = window.requestAnimationFrame(draw);
    };

    if (fixedImage && spritePath) {
      fixedImage.onload = () => { if (reduceMotion && !cancelled) draw(performance.now()); };
      fixedImage.src = spritePath;
    }
    draw(start);
    return () => { cancelled = true; window.cancelAnimationFrame(frame); };
  }, [fromLeft, stage, type]);

  return <canvas ref={canvasRef} width="960" height="288" aria-hidden className={className} />;
}
