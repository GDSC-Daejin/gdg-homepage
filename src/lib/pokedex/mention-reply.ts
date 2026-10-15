import { RARITY_PROBABILITY, catchRatePercent, spawnSharePercent, type PokemonProbabilityRow } from "@/lib/pokedex/probability";

export const MENTION_USAGE = "포켓몬 이름과 함께 물어보세요. 예: `@도감봇 피카츄 포획률 알려줘`";

const RATE_QUESTION = /포획\s*(률|확률)|잡을\s*확률|잡힐\s*확률|확률/;

function normalize(text: string) {
  return text.replace(/<@[A-Z0-9]+(\|[^>]*)?>/g, " ").replace(/\s+/g, "");
}

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length];
}

// 띄어쓰기와 "~의" 같은 조사가 붙어도 찾도록, 공백을 뺀 문장에서 가장 긴 이름부터 찾는다.
export function findPokemonByName(text: string, catalog: PokemonProbabilityRow[]) {
  const flat = normalize(text);
  return [...catalog].sort((a, b) => b.name_ko.length - a.name_ko.length).find((entry) => flat.includes(entry.name_ko)) ?? null;
}

export function suggestPokemonNames(text: string, catalog: PokemonProbabilityRow[], limit = 3) {
  const tokens = text.replace(/<@[A-Z0-9]+(\|[^>]*)?>/g, " ").split(/\s+/).filter((token) => token.length >= 2);
  const scored = catalog.flatMap((entry) => {
    const best = Math.min(...tokens.flatMap((token) => {
      const windows = token.length <= entry.name_ko.length ? [token] : Array.from({ length: token.length - entry.name_ko.length + 1 }, (_, i) => token.slice(i, i + entry.name_ko.length));
      return windows.map((part) => distance(part, entry.name_ko));
    }), Infinity);
    return best <= (entry.name_ko.length >= 3 ? 1 : 0) ? [{ name: entry.name_ko, score: best }] : [];
  });
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((item) => item.name);
}

export function isRateQuestion(text: string) {
  return RATE_QUESTION.test(normalize(text));
}

export function pokemonRateMessage(entry: PokemonProbabilityRow, catalog: PokemonProbabilityRow[]) {
  const total = catalog.reduce((sum, item) => sum + item.spawn_weight, 0);
  const share = spawnSharePercent(entry.spawn_weight, total);
  return [
    `*${entry.name_ko}* (No.${String(entry.pokedex_no).padStart(3, "0")}) · ${RARITY_PROBABILITY[entry.rarity].label}`,
    `• 기본 몬스터볼 포획률: ${catchRatePercent(entry.catch_rate)}%`,
    `• 출현 가중치: ${entry.spawn_weight} (전체 ${total} 중 ${share}%)`,
    "자세한 표는 웹의 도감 > 확률표(/pokedex?tab=probabilities)에서 볼 수 있어요.",
  ].join("\n");
}

export function buildMentionReply(text: string, catalog: PokemonProbabilityRow[]) {
  const found = findPokemonByName(text, catalog);
  if (found) return isRateQuestion(text) ? pokemonRateMessage(found, catalog) : `${MENTION_USAGE}\n(\`${found.name_ko} 포획률\`처럼 "포획률"을 함께 적어 주세요.)`;
  if (!isRateQuestion(text)) return MENTION_USAGE;
  const suggestions = suggestPokemonNames(text, catalog);
  return suggestions.length
    ? `그 이름의 포켓몬을 찾지 못했어요. 혹시 ${suggestions.map((name) => `*${name}*`).join(", ")}${suggestions.length > 1 ? " 중 하나일까요?" : "일까요?"}`
    : `그 이름의 포켓몬을 찾지 못했어요. ${MENTION_USAGE}`;
}
