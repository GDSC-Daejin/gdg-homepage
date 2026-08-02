export type BattleType = "normal" | "fire" | "water" | "electric" | "grass" | "ice" | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug" | "rock" | "ghost" | "dragon" | "fairy" | "steel";

const EFFECTS: Record<BattleType, { label: string; symbol: string; className: string }> = {
  normal: { label: "노말", symbol: "●", className: "bg-gray-300 text-gray-700" },
  fire: { label: "불꽃", symbol: "✦", className: "bg-orange-500 text-white" },
  water: { label: "물", symbol: "≋", className: "bg-sky-500 text-white" },
  electric: { label: "전기", symbol: "ϟ", className: "bg-yellow-400 text-yellow-950" },
  grass: { label: "풀", symbol: "✿", className: "bg-green-500 text-white" },
  ice: { label: "얼음", symbol: "✧", className: "bg-cyan-300 text-cyan-950" },
  fighting: { label: "격투", symbol: "✹", className: "bg-red-600 text-white" },
  poison: { label: "독", symbol: "◆", className: "bg-purple-600 text-white" },
  ground: { label: "땅", symbol: "◆", className: "bg-amber-600 text-white" },
  flying: { label: "비행", symbol: "≈", className: "bg-sky-300 text-sky-950" },
  psychic: { label: "에스퍼", symbol: "◉", className: "bg-pink-500 text-white" },
  bug: { label: "벌레", symbol: "✦", className: "bg-lime-600 text-white" },
  rock: { label: "바위", symbol: "◆", className: "bg-stone-600 text-white" },
  ghost: { label: "고스트", symbol: "☾", className: "bg-violet-700 text-white" },
  dragon: { label: "드래곤", symbol: "✧", className: "bg-indigo-600 text-white" },
  fairy: { label: "페어리", symbol: "✦", className: "bg-rose-300 text-rose-950" },
  steel: { label: "강철", symbol: "✦", className: "bg-slate-500 text-white" },
};

export function battleEffect(type: BattleType) {
  return EFFECTS[type];
}
