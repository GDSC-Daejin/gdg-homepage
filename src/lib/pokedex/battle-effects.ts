export type BattleType = "normal" | "fire" | "water" | "electric" | "grass" | "ice" | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug" | "rock" | "ghost" | "dragon" | "fairy" | "steel";

/** 전투 연출 계열. 불·물·전기·풀·노말은 고유 연출, 나머지 타입은 가까운 계열을 공유한다. */
export type BattleMotion = "flame" | "splash" | "bolt" | "leaf" | "strike" | "wave";

/** [어두운색, 기본색, 밝은색, 반짝임] */
export type BattlePalette = readonly [dark: string, main: string, light: string, sparkle: string];

type Effect = { label: string; symbol: string; className: string; motion: BattleMotion; palette: BattlePalette; spritePath: string };

const EFFECTS: Record<BattleType, Effect> = {
  normal: { label: "노말", symbol: "●", className: "bg-gray-300 text-gray-700", motion: "strike", palette: ["#64748b", "#cbd5e1", "#f8fafc", "#ffffff"], spritePath: "/pokedex/effects/normal.webp" },
  fire: { label: "불꽃", symbol: "✦", className: "bg-orange-500 text-white", motion: "flame", palette: ["#b91c1c", "#f97316", "#fef08a", "#fff7ed"], spritePath: "/pokedex/effects/fire.webp" },
  water: { label: "물", symbol: "≋", className: "bg-sky-500 text-white", motion: "splash", palette: ["#0369a1", "#0ea5e9", "#e0f2fe", "#ffffff"], spritePath: "/pokedex/effects/water.webp" },
  electric: { label: "전기", symbol: "ϟ", className: "bg-yellow-400 text-yellow-950", motion: "bolt", palette: ["#ca8a04", "#facc15", "#fef9c3", "#ffffff"], spritePath: "/pokedex/effects/electric.webp" },
  grass: { label: "풀", symbol: "✿", className: "bg-green-500 text-white", motion: "leaf", palette: ["#15803d", "#22c55e", "#dcfce7", "#ffffff"], spritePath: "/pokedex/effects/grass.webp" },
  ice: { label: "얼음", symbol: "✧", className: "bg-cyan-300 text-cyan-950", motion: "splash", palette: ["#0891b2", "#67e8f9", "#ecfeff", "#ffffff"], spritePath: "/pokedex/effects/ice.webp" },
  fighting: { label: "격투", symbol: "✹", className: "bg-red-600 text-white", motion: "strike", palette: ["#b91c1c", "#ef4444", "#fee2e2", "#ffffff"], spritePath: "/pokedex/effects/fighting.webp" },
  poison: { label: "독", symbol: "◆", className: "bg-purple-600 text-white", motion: "wave", palette: ["#7e22ce", "#a855f7", "#f3e8ff", "#ffffff"], spritePath: "/pokedex/effects/poison.webp" },
  ground: { label: "땅", symbol: "◆", className: "bg-amber-600 text-white", motion: "strike", palette: ["#92400e", "#d97706", "#fef3c7", "#ffffff"], spritePath: "/pokedex/effects/ground.webp" },
  flying: { label: "비행", symbol: "≈", className: "bg-sky-300 text-sky-950", motion: "leaf", palette: ["#0284c7", "#38bdf8", "#e0f2fe", "#ffffff"], spritePath: "/pokedex/effects/wind.webp" },
  psychic: { label: "에스퍼", symbol: "◉", className: "bg-pink-500 text-white", motion: "wave", palette: ["#be185d", "#ec4899", "#fce7f3", "#ffffff"], spritePath: "/pokedex/effects/psychic.webp" },
  bug: { label: "벌레", symbol: "✦", className: "bg-lime-600 text-white", motion: "leaf", palette: ["#4d7c0f", "#84cc16", "#ecfccb", "#ffffff"], spritePath: "/pokedex/effects/bug.webp" },
  rock: { label: "바위", symbol: "◆", className: "bg-stone-600 text-white", motion: "strike", palette: ["#713f12", "#a16207", "#fef3c7", "#ffffff"], spritePath: "/pokedex/effects/rock.webp" },
  ghost: { label: "고스트", symbol: "☾", className: "bg-violet-700 text-white", motion: "wave", palette: ["#5b21b6", "#8b5cf6", "#ede9fe", "#ffffff"], spritePath: "/pokedex/effects/ghost.webp" },
  dragon: { label: "드래곤", symbol: "✧", className: "bg-indigo-600 text-white", motion: "flame", palette: ["#4338ca", "#6366f1", "#e0e7ff", "#ffffff"], spritePath: "/pokedex/effects/dragon.webp" },
  fairy: { label: "페어리", symbol: "✦", className: "bg-rose-300 text-rose-950", motion: "wave", palette: ["#be185d", "#f472b6", "#fce7f3", "#ffffff"], spritePath: "/pokedex/effects/fairy.webp" },
  steel: { label: "강철", symbol: "✦", className: "bg-slate-500 text-white", motion: "strike", palette: ["#334155", "#64748b", "#f8fafc", "#ffffff"], spritePath: "/pokedex/effects/steel.webp" },
};

export function isBattleType(type: string): type is BattleType {
  return Object.hasOwn(EFFECTS, type);
}

/** 알 수 없는 타입 문자열(DB 값 등)은 노말 연출로 대체한다. */
export function battleEffect(type: BattleType | string) {
  return EFFECTS[isBattleType(type) ? type : "normal"];
}
