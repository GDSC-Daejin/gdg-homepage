import type { RankingLeagueState, RankingPokemon } from "@/lib/pokedex/ranking-league";

/**
 * 랭킹전 리디자인 시안 확인용 데이터.
 *
 * 포켓몬·상대·리더보드·전투 기록은 실제 서비스 타입(RankingLeagueState)을 그대로 쓴다.
 * 시안에만 있고 서비스에는 없는 것은 PREVIEW_EXTRA에 모아뒀고,
 * 그 중 무엇을 채택했는지는 UNADOPTED에 적어 둔다.
 */

export const SPRITE = (no: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${no}.png`;

export const PREVIEW_PROFILE_ID = "ranking-preview-player";
export const ME = { name: "나", nickname: "아리" };
export const ME_LABEL = `${ME.name} (${ME.nickname})`;

export const OWNED_POKEMON: RankingPokemon[] = [
  { throwId: "preview-squirtle", pokemonId: "squirtle", name: "꼬부기", imagePath: SPRITE(7), combatPower: 451, battleType: "water", rarity: "common" },
  { throwId: "preview-pikachu", pokemonId: "pikachu", name: "피카츄", imagePath: SPRITE(25), combatPower: 508, battleType: "electric", rarity: "uncommon" },
  { throwId: "preview-oddish", pokemonId: "oddish", name: "뚜벅쵸", imagePath: SPRITE(43), combatPower: 427, battleType: "grass", rarity: "common" },
  { throwId: "preview-growlithe", pokemonId: "growlithe", name: "가디", imagePath: SPRITE(58), combatPower: 532, battleType: "fire", rarity: "rare" },
  { throwId: "preview-geodude", pokemonId: "geodude", name: "꼬마돌", imagePath: SPRITE(74), combatPower: 486, battleType: "rock", rarity: "uncommon" },
  { throwId: "preview-eevee", pokemonId: "eevee", name: "이브이", imagePath: SPRITE(133), combatPower: 519, battleType: "normal", rarity: "rare" },
];

export const pokemonOf = (throwId: string) =>
  OWNED_POKEMON.find((pokemon) => pokemon.throwId === throwId);

export const sumPower = (throwIds: string[]) =>
  throwIds.reduce((total, throwId) => total + (pokemonOf(throwId)?.combatPower ?? 0), 0);

const RIVAL = (nickname: string) => ({ name: "랭킹 트레이너", nickname });

/** 실제 서비스 상태 그대로. 방어 덱은 아직 활성화하지 않은 상태로 시작한다. */
export const PREVIEW_STATE: RankingLeagueState = {
  eligible: true,
  season: { id: "preview-season", startsAt: "2026-07-20T21:00:00.000Z", endsAt: "2026-08-17T21:00:00.000Z" },
  entry: { rating: 1_060, matches: 19, attacks: 12, attacksToday: 0, wins: 12, activeDefenseSlot: null, activeAttackSlot: 1, defenseEffectiveOn: null, rerolled: false, rank: 7 },
  ownedPokemon: OWNED_POKEMON,
  presets: [
    { kind: "attack", slot: 1, members: ["preview-geodude", "preview-squirtle", "preview-growlithe"].map((id) => pokemonOf(id)!) },
    { kind: "attack", slot: 2, members: ["preview-pikachu", "preview-growlithe", "preview-eevee"].map((id) => pokemonOf(id)!) },
    { kind: "attack", slot: 3, members: [] },
    { kind: "defense", slot: 1, members: [] },
    { kind: "defense", slot: 2, members: [] },
    { kind: "defense", slot: 3, members: [] },
  ],
  opponents: [
    { allocationId: "preview-opponent-1", ...RIVAL("번개"), avatarPath: null, partyType: "electric", lead: { throwId: "opponent-magnemite", pokemonId: "magnemite", name: "코일", imagePath: SPRITE(81), combatPower: 533, battleType: "electric", rarity: "uncommon" }, powerFloor: 1_500 },
    { allocationId: "preview-opponent-2", ...RIVAL("불꽃"), avatarPath: null, partyType: "fire", lead: { throwId: "opponent-vulpix", pokemonId: "vulpix", name: "식스테일", imagePath: SPRITE(37), combatPower: 524, battleType: "fire", rarity: "uncommon" }, powerFloor: 1_600 },
    { allocationId: "preview-opponent-3", ...RIVAL("물결"), avatarPath: null, partyType: "water", lead: { throwId: "opponent-psyduck", pokemonId: "psyduck", name: "고라파덕", imagePath: SPRITE(54), combatPower: 498, battleType: "water", rarity: "common" }, powerFloor: 1_400 },
  ],
  // 점수 30/30/10/10은 실제 규칙 그대로다. 화면의 점수 추이·전적·방어 승률은 전부 여기서 파생된다.
  battles: [
    { id: "b1", role: "attacker", opponentName: "랭킹 트레이너", opponentNickname: "풀잎", winnerId: PREVIEW_PROFILE_ID, attackerDelta: 30, defenderDelta: -10, createdAt: "2026-08-03T00:12:00.000Z" },
    { id: "b2", role: "defender", opponentName: "랭킹 트레이너", opponentNickname: "번개", winnerId: "preview-thunder", attackerDelta: 30, defenderDelta: -10, createdAt: "2026-08-02T12:40:00.000Z" },
    { id: "b3", role: "defender", opponentName: "랭킹 트레이너", opponentNickname: "물결", winnerId: "preview-wave", attackerDelta: 30, defenderDelta: -10, createdAt: "2026-08-02T11:48:00.000Z" },
    { id: "b4", role: "defender", opponentName: "랭킹 트레이너", opponentNickname: "바위", winnerId: PREVIEW_PROFILE_ID, attackerDelta: -30, defenderDelta: 10, createdAt: "2026-08-02T11:05:00.000Z" },
    { id: "b5", role: "attacker", opponentName: "랭킹 트레이너", opponentNickname: "물결", winnerId: PREVIEW_PROFILE_ID, attackerDelta: 30, defenderDelta: -10, createdAt: "2026-08-02T01:22:00.000Z" },
    { id: "b6", role: "attacker", opponentName: "랭킹 트레이너", opponentNickname: "챔피언", winnerId: "preview-champion", attackerDelta: -30, defenderDelta: 10, createdAt: "2026-08-01T09:31:00.000Z" },
  ],
  leaderboard: [
    { rank: 1, userId: "preview-champion", ...RIVAL("챔피언"), rating: 1_260 },
    { rank: 2, userId: "preview-thunder", ...RIVAL("번개"), rating: 1_180 },
    { rank: 3, userId: "preview-flame", ...RIVAL("불꽃"), rating: 1_120 },
  ],
};

export const REROLLED_OPPONENTS: RankingLeagueState["opponents"] = [
  { allocationId: "preview-opponent-4", ...RIVAL("바위"), avatarPath: null, partyType: "rock", lead: { throwId: "opponent-onix", pokemonId: "onix", name: "롱스톤", imagePath: SPRITE(95), combatPower: 574, battleType: "rock", rarity: "rare" }, powerFloor: 1_700 },
  { allocationId: "preview-opponent-5", ...RIVAL("풀잎"), avatarPath: null, partyType: "mixed", lead: { throwId: "opponent-bellsprout", pokemonId: "bellsprout", name: "모다피", imagePath: SPRITE(69), combatPower: 491, battleType: "grass", rarity: "common" }, powerFloor: 1_500 },
  { allocationId: "preview-opponent-6", ...RIVAL("물결"), avatarPath: null, partyType: "water", lead: { throwId: "opponent-staryu", pokemonId: "staryu", name: "별가사리", imagePath: SPRITE(120), combatPower: 546, battleType: "water", rarity: "rare" }, powerFloor: 1_600 },
];

export function displayName(name: string, nickname: string | null) {
  return nickname ? `${name} (${nickname})` : name;
}

/* ── 실제 서비스 규칙 (설계서·page.tsx의 안내 문구에서 가져옴) ── */

export const RULES = {
  reveal: "선봉 한 마리와 합산 전투력 천 단위만 공개돼요",
  defenseDelay: "활성화한 방어 덱은 다음 날 06:00부터 매칭에 반영돼요",
  presetRule: "같은 종은 중복할 수 없고 전설·환상은 한 마리만 넣을 수 있어요",
  noDefense: "방어 덱을 비워두면 다른 트레이너가 그냥 이겨요",
  refreshAt: "06:00",
};

/* ── 시안에만 있는 보조 데이터 ── */

export type OpponentRead = { allocationId: string; verdict: "유리" | "호각" | "불리"; verdictLong: string; tone: "pos" | "neu" | "neg"; power: number; defenseWinRate: number; hint: string };

/**
 * 시안에는 있지만 **채택하지 않기로 한** 블록. 화면에서 지우지 않고 남겨 둔 이유는
 * 어떤 안을 왜 접었는지 기록으로 두기 위해서다. 이 목록의 항목은 실제 화면에 옮기지 않는다.
 */
export const UNADOPTED = [
  "티어/등급 배지 — 시즌은 1,000점에서 시작하는 점수제만 쓴다",
  "순위 변동(▲2) — 일별 순위 스냅샷이 없다",
  "상대 상성 판정·조언, 상대 방어 승률, 타입 대비 추천 조합 — 미공개 2마리 정보가 새어나간다",
  "포켓몬별 승률·라이벌 상대전적 — 팀 단위 승패를 개별에 배분하기 어렵다",
  "동아리 소식 피드 — 공개 범위를 정한 뒤에 다시 본다",
];

export const PREVIEW_EXTRA = {
  opponentReads: [
    { allocationId: "preview-opponent-1", verdict: "유리", verdictLong: "상성 유리 · 승산 높아요", tone: "pos", power: 62, defenseWinRate: 41, hint: "내 꼬마돌(바위)이 전기 타입 선봉을 받아칠 수 있어요" },
    { allocationId: "preview-opponent-2", verdict: "호각", verdictLong: "호각 · 선봉 순서가 갈라요", tone: "neu", power: 80, defenseWinRate: 58, hint: "가디(불)는 이득이 없어요 · 꼬부기를 선봉으로 바꿔보세요" },
    { allocationId: "preview-opponent-3", verdict: "불리", verdictLong: "상성 불리 · 신중하게", tone: "neg", power: 46, defenseWinRate: 66, hint: "꼬부기(물)는 상성 이득이 없어요 · 뚜벅쵸를 넣어보세요" },
  ] satisfies OpponentRead[],

  feed: [
    { who: "랭킹 트레이너 (번개)", whom: ME_LABEL, note: "방어 실패 · -10", win: false, time: "12분 전", no: 26 },
    { who: ME_LABEL, whom: "랭킹 트레이너 (풀잎)", note: "공격 성공 · +30", win: true, time: "오늘 09:12", no: 74 },
    { who: "랭킹 트레이너 (챔피언)", whom: "랭킹 트레이너 (불꽃)", note: "1위 방어 성공", win: true, time: "오늘 08:40", no: 6 },
    { who: "랭킹 트레이너 (바위)", whom: "랭킹 트레이너 (물결)", note: "3연승 중", win: true, time: "어제 22:05", no: 95 },
  ],

  winRates: [
    { no: 74, name: "꼬마돌", wins: 6, losses: 1 },
    { no: 7, name: "꼬부기", wins: 5, losses: 2 },
    { no: 58, name: "가디", wins: 4, losses: 3 },
    { no: 25, name: "피카츄", wins: 3, losses: 4 },
    { no: 133, name: "이브이", wins: 2, losses: 4 },
  ],

  rivals: [
    { no: 81, name: "랭킹 트레이너 (번개)", lead: "코일", wins: 2, losses: 3 },
    { no: 37, name: "랭킹 트레이너 (불꽃)", lead: "식스테일", wins: 4, losses: 1 },
    { no: 54, name: "랭킹 트레이너 (물결)", lead: "고라파덕", wins: 1, losses: 1 },
  ],

  recommendations: [
    { title: "전기·불 대비형", note: "오늘 상대 3명 중 2명에게 유리", members: ["preview-geodude", "preview-squirtle", "preview-oddish"] },
    { title: "전투력 최대형", note: "방어 덱으로 추천", members: ["preview-growlithe", "preview-eevee", "preview-pikachu"] },
  ],
};

/** 시안 확인용 고정 기준일. 실제 화면에서는 Date.now()를 쓴다. */
export const TODAY = Date.parse("2026-08-03T03:00:00.000Z");

export function seasonRange(season: RankingLeagueState["season"]) {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" });
  return `${format(season.startsAt)} – ${format(season.endsAt)}`;
}
