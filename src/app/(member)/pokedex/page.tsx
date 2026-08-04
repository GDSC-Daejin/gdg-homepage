import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { PageHeader } from "@/components/PageHeader";
import { PokedexBattleTab } from "./PokedexBattleTab";
import type { DuelMember, DuelTurn, OwnedBattlePokemon, PokemonDuel } from "@/lib/pokedex/duel";
import type { BattleType } from "@/lib/pokedex/battle-effects";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { RANKING_LEAGUE_OPEN } from "@/lib/pokedex/ranking-open";

type Pokemon = { id: string; pokedex_no: number; name_ko: string; image_path: string; rarity: Rarity; spawn_weight: number; catch_rate: number };
type Rarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";
type OwnedThrow = { id: string; pokemon: { name_ko: string; image_path: string } | null; appearance: { combat_power: number | null } | null };
type DuelRow = {
  id: string; status: PokemonDuel["status"]; created_at: string; winner_id: string | null; first_turn_user_id: string | null; battle_log: DuelTurn[] | null;
  challenger_id: string; challenger_name: string; challenger_nickname: string | null; challenger_avatar_path: string | null; challenger_pokemon_name: string; challenger_image_path: string; challenger_battle_type: BattleType; challenger_combat_power: number; challenger_score: number | null;
  opponent_id: string; opponent_name: string; opponent_nickname: string | null; opponent_avatar_path: string | null; opponent_pokemon_name: string | null; opponent_image_path: string | null; opponent_battle_type: BattleType | null; opponent_combat_power: number | null; opponent_score: number | null;
};

const DEMO_POKEMON: Pokemon[] = [
  { id: "demo-7", pokedex_no: 7, name_ko: "꼬부기", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png", rarity: "uncommon", spawn_weight: 55, catch_rate: 0.6 },
  { id: "demo-25", pokedex_no: 25, name_ko: "피카츄", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png", rarity: "uncommon", spawn_weight: 55, catch_rate: 0.6 },
  { id: "demo-133", pokedex_no: 133, name_ko: "이브이", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png", rarity: "rare", spawn_weight: 25, catch_rate: 0.48 },
];

const RARITY_INFO: Record<Rarity, { label: string; weight: number; catchRate: number; tone: "neutral" | "primary" | "warning" | "danger" }> = {
  common: { label: "일반", weight: 100, catchRate: 70, tone: "neutral" },
  uncommon: { label: "흔치않음", weight: 55, catchRate: 60, tone: "primary" },
  rare: { label: "희귀", weight: 25, catchRate: 48, tone: "warning" },
  very_rare: { label: "매우 희귀", weight: 12, catchRate: 36, tone: "danger" },
  legendary: { label: "전설/환상", weight: 8, catchRate: 28, tone: "danger" },
};

export function RankingLeagueComingSoon() {
  return <section>
    <Card className="relative overflow-hidden border-primary !bg-primary p-6 text-white sm:p-8">
      <div className="relative z-10 max-w-xl"><p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">✨ 추후 오픈 예정</p><h2 className="mt-4 text-3xl font-bold leading-[1.15] tracking-[-0.03em] sm:text-4xl">도감 랭킹전</h2><p className="mt-3 text-sm leading-6 text-white/90 sm:text-base sm:leading-7"><span className="block">포켓몬을 모으는 동안 규칙을 미리 익혀두세요.</span><span className="block">준비가 되면 나만의 팀으로 바로 도전할 수 있어요.</span></p></div>
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" alt="피카츄" className="absolute bottom-0 right-3 h-36 w-36 object-contain drop-shadow-lg sm:right-8 sm:h-48 sm:w-48" />
    </Card>
    <div className="mt-4 rounded-xl border border-primary-soft-hover bg-primary-soft px-5 py-4"><h3 className="text-base font-bold leading-6 tracking-[-0.02em] text-primary">처음이라면, 이 순서대로 준비해요</h3><p className="mt-1 text-sm leading-6 text-gray-700">랭킹전은 포켓몬을 모으고, 팀을 만들고, 매일 다른 트레이너와 겨루는 3:3 대결이에요.</p></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card className="relative min-h-48 overflow-hidden p-5 pr-36"><p className="text-xs font-extrabold tracking-[0.12em] text-primary">STEP 1</p><h3 className="mt-2 min-h-12 text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-gray-900 sm:text-lg sm:tracking-[-0.03em]">서로 다른 포켓몬 6종을 모아요</h3><p className="mt-2 text-sm leading-6 text-gray-600"><span className="block">같은 포켓몬을 여러 마리 포획해도 좋아요.</span><span className="block"><strong className="font-bold text-primary">서로 다른 6종</strong>을 모으면 참가할 수 있어요.</span></p><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png" alt="꼬부기" className="absolute right-1 top-[3.5rem] h-32 w-32 -translate-y-4 object-contain drop-shadow-md sm:h-36 sm:w-36" /></Card>
      <Card className="relative min-h-48 overflow-hidden p-5 pr-36"><p className="text-xs font-extrabold tracking-[0.12em] text-primary">STEP 2</p><h3 className="mt-2 min-h-12 text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-gray-900 sm:text-lg sm:tracking-[-0.03em]">공격 팀과 방어 팀을 만들어요</h3><p className="mt-2 text-sm leading-6 text-gray-600"><span className="block">각 팀은 <strong className="font-bold text-primary">서로 다른 3마리</strong>로 구성해요.</span><span className="block">전설·환상 포켓몬은 한 마리까지예요.</span></p><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png" alt="이브이" className="absolute right-1 top-[3.5rem] h-32 w-32 -translate-y-4 object-contain drop-shadow-md sm:h-36 sm:w-36" /></Card>
      <Card className="relative min-h-48 overflow-hidden p-5 pr-36"><p className="text-xs font-extrabold tracking-[0.12em] text-primary">STEP 3</p><h3 className="mt-2 min-h-12 text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-gray-900 sm:text-lg sm:tracking-[-0.03em]">매일 바뀌는 상대에게 도전해요</h3><p className="mt-2 text-sm leading-6 text-gray-600"><span className="block">하루에 <strong className="font-bold text-primary">최대 3번</strong> 공격할 수 있어요.</span><span className="block">상대는 매일 오전 6시에 바뀌어요.</span></p><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png" alt="파이리" className="absolute right-1 top-[3.5rem] h-32 w-32 -translate-y-4 object-contain drop-shadow-md sm:h-36 sm:w-36" /></Card>
      <Card className="relative min-h-48 overflow-hidden p-5 pr-36"><p className="text-xs font-extrabold tracking-[0.12em] text-primary">STEP 4</p><h3 className="mt-2 min-h-12 text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-gray-900 sm:text-lg sm:tracking-[-0.03em]">타입과 팀 조합으로 승부해요</h3><p className="mt-2 text-sm leading-6 text-gray-600"><span className="block">전투력과 타입 상성이 승부에 반영돼요.</span><span className="block"><strong className="font-bold text-primary">같은 타입 팀</strong>에는 보너스가 더해져요.</span></p><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" alt="이상해씨" className="absolute right-1 top-[3.5rem] h-32 w-32 -translate-y-1 object-contain drop-shadow-md sm:h-36 sm:w-36" /></Card>
    </div>
    <Card className="mt-4 p-5"><h3 className="text-base font-bold leading-6 tracking-[-0.02em] text-gray-900">점수는 이렇게 바뀌어요</h3><p className="mt-1 text-sm leading-6 text-gray-600"><span className="block">공격에서 이기면 <strong className="font-bold text-primary">+30점</strong>, 지면 <strong className="font-bold text-primary">-30점</strong>이에요.</span><span className="block">방어에 성공하면 <strong className="font-bold text-primary">+10점</strong>, 실패하면 <strong className="font-bold text-primary">-10점</strong>이에요.</span><span className="block">방어 덱을 바꾸면 다음 날 <strong className="font-bold text-primary">오전 6시</strong>부터 매칭에 반영돼요.</span></p></Card>
  </section>;
}

export function RankingLeagueTab({ profileId, state }: { profileId: string; state: RankingLeagueState | null }) {
  return !RANKING_LEAGUE_OPEN ? <RankingLeagueComingSoon /> : state ? <PokedexBattleTab kind="ranking" profileId={profileId} state={state} /> : <EmptyState title="랭킹전을 준비하고 있어요" description="데모에서는 랭킹전을 이용할 수 없어요." />;
}

export default async function PokedexPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[]; q?: string | string[] }> }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const requestedTab = params.tab;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const tab = requestedTab === "probabilities" ? "probabilities" : requestedTab === "duels" ? "duels" : requestedTab === "ranking" ? "ranking" : "collection";
  let pokemon = DEMO_POKEMON;
  let ballCount = 2;
  let caughtIds = ["demo-7"];
  let ownedBattlePokemon: OwnedBattlePokemon[] = [];
  let duelMembers: DuelMember[] = [];
  let duels: PokemonDuel[] = [];
  let rankingState: RankingLeagueState | null = null;
  const shouldLoadCollectionData = tab === "collection" || tab === "probabilities";
  const shouldLoadDuelData = tab === "duels";
  const shouldLoadRankingData = tab === "ranking" && RANKING_LEAGUE_OPEN;

  if ((shouldLoadCollectionData || shouldLoadDuelData || shouldLoadRankingData) && !(await isDemoMode())) {
    const supabase = await createClient();
    const [{ data: catalog }, { data: inventory }, { data: throws }, { data: ownedThrows }, { data: members }, { data: duelRows }, { data: rankState }] = await Promise.all([
      shouldLoadCollectionData ? supabase.from("pokemon_catalog").select("id, pokedex_no, name_ko, image_path, rarity, spawn_weight, catch_rate").order("pokedex_no") : Promise.resolve({ data: null }),
      tab === "collection" ? supabase.from("pokemon_ball_inventory").select("quantity").eq("user_id", profile.id).eq("ball_slug", "poke_ball").maybeSingle() : Promise.resolve({ data: null }),
      shouldLoadCollectionData ? supabase.from("pokemon_throws").select("pokemon_id").eq("user_id", profile.id).eq("outcome", "caught") : Promise.resolve({ data: null }),
      shouldLoadDuelData ? supabase.from("pokemon_throws").select("id, pokemon:pokemon_catalog(name_ko, image_path), appearance:pokemon_appearances(combat_power)").eq("user_id", profile.id).eq("outcome", "caught").order("created_at", { ascending: false }).returns<OwnedThrow[]>() : Promise.resolve({ data: null }),
      shouldLoadDuelData ? supabase.rpc("pokedex_duel_members") : Promise.resolve({ data: null }),
      shouldLoadDuelData ? supabase.rpc("pokedex_duel_list") : Promise.resolve({ data: null }),
      shouldLoadRankingData ? supabase.rpc("pokedex_rank_state") : Promise.resolve({ data: null }),
    ]);
    pokemon = (catalog ?? []) as Pokemon[];
    ballCount = inventory?.quantity ?? 0;
    caughtIds = ((throws ?? []) as { pokemon_id: string }[]).map((throwRecord) => throwRecord.pokemon_id);
    ownedBattlePokemon = (ownedThrows ?? []).flatMap((throwRecord) => {
      const caughtPokemon = throwRecord.pokemon;
      const combatPower = throwRecord.appearance?.combat_power;
      return caughtPokemon && combatPower !== null && combatPower !== undefined ? [{ id: throwRecord.id, pokemonName: caughtPokemon.name_ko, imagePath: caughtPokemon.image_path, combatPower }] : [];
    });
    duelMembers = ((members ?? []) as { id: string; name: string; nickname: string | null; avatar_path: string | null }[]).map((member) => ({ ...member, avatarPath: member.avatar_path }));
    duels = ((duelRows ?? []) as DuelRow[]).map((duel) => ({
      id: duel.id,
      status: duel.status,
      createdAt: duel.created_at,
      winnerId: duel.winner_id,
      firstTurnUserId: duel.first_turn_user_id,
      battleLog: duel.battle_log ?? undefined,
      challenger: { userId: duel.challenger_id, name: duel.challenger_name, nickname: duel.challenger_nickname, avatarPath: duel.challenger_avatar_path, battleType: duel.challenger_battle_type, pokemonName: duel.challenger_pokemon_name, imagePath: duel.challenger_image_path, combatPower: duel.challenger_combat_power, score: duel.challenger_score },
      opponent: { userId: duel.opponent_id, name: duel.opponent_name, nickname: duel.opponent_nickname, avatarPath: duel.opponent_avatar_path, battleType: duel.opponent_battle_type ?? "normal", pokemonName: duel.opponent_pokemon_name, imagePath: duel.opponent_image_path, combatPower: duel.opponent_combat_power, score: duel.opponent_score },
    }));
    rankingState = rankState as RankingLeagueState | null;
  }

  const countByPokemon = new Map<string, number>();
  for (const id of caughtIds) countByPokemon.set(id, (countByPokemon.get(id) ?? 0) + 1);
  const collected = countByPokemon.size;
  const visiblePokemon = query ? pokemon.filter((pokemon) => pokemon.name_ko.includes(query)) : pokemon;

  return (
    <div>
      <PageHeader title="포켓몬 도감" description="슬랙에서 몬스터볼을 던져 포켓몬을 모아보세요." />
      <nav aria-label="포켓몬 도감" className="mb-6 flex gap-1 border-b border-gray-200">
        <Link href="/pokedex" aria-current={tab === "collection" ? "page" : undefined} className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${tab === "collection" ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>내 도감</Link>
        <Link href="/pokedex?tab=probabilities" aria-current={tab === "probabilities" ? "page" : undefined} className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${tab === "probabilities" ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>확률표</Link>
        <Link href="/pokedex?tab=duels" aria-current={tab === "duels" ? "page" : undefined} className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${tab === "duels" ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>결투</Link>
        <Link href="/pokedex?tab=ranking" aria-current={tab === "ranking" ? "page" : undefined} className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${tab === "ranking" ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>랭킹전</Link>
      </nav>
      {tab === "collection" ? <>
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-sm text-gray-500">획득한 포켓몬</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{collected}<span className="ml-1 text-base font-medium text-gray-500">/ {pokemon.length}종</span></p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-500">몬스터볼</p>
            <p className="mt-1 text-3xl font-bold text-primary">{ballCount}<span className="ml-1 text-base font-medium text-gray-500">개</span></p>
          </Card>
        </div>
        {pokemon.length === 0 ? <EmptyState title="도감을 준비하고 있어요" description="도감봇이 활성화되면 포켓몬을 만날 수 있어요." /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{pokemon.map((entry) => {
          const count = countByPokemon.get(entry.id) ?? 0;
          return <Link key={entry.id} href={`/pokedex/${entry.pokedex_no}`} className="rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"><Card className={`p-4 text-center transition-transform hover:-translate-y-0.5 ${count ? "" : "grayscale opacity-45"}`}><img src={entry.image_path} alt={count ? entry.name_ko : "미획득 포켓몬"} loading="lazy" decoding="async" className={`mx-auto h-20 w-20 object-contain ${count ? "" : "brightness-0"}`} /><p className="mt-2 text-sm font-semibold text-gray-900">{count ? entry.name_ko : "???"}</p><p className="mt-1 text-xs text-gray-500">{count ? `${count}마리 보유` : `No. ${entry.pokedex_no}`}</p></Card></Link>;
        })}</div>}
      </> : tab === "duels" ? <PokedexBattleTab kind="duel" profileId={profile.id} members={duelMembers} ownedPokemon={ownedBattlePokemon} duels={duels} /> : tab === "ranking" ? <RankingLeagueTab profileId={profile.id} state={rankingState} /> : <>
        <form action="/pokedex" className="mb-4 flex gap-2">
          <input type="hidden" name="tab" value="probabilities" />
          <div className="flex-1"><Input id="pokemon-search" name="q" type="search" defaultValue={query} aria-label="포켓몬 이름 검색" placeholder="포켓몬 이름 검색" /></div>
          <Button type="submit" variant="primary">검색</Button>
        </form>
        <Card className="mb-6 overflow-x-auto p-0">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">희귀도별 확률</h2><p className="mt-1 text-sm text-gray-500">하루 3회, 가중치 비례·중복 없이 선정돼요.</p></div>
          <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-5 py-3 font-medium">희귀도</th><th className="px-5 py-3 text-right font-medium">출현 가중치</th><th className="px-5 py-3 text-right font-medium">기본 몬스터볼 포획률</th></tr></thead><tbody>{Object.entries(RARITY_INFO).map(([rarity, info]) => <tr key={rarity} className="border-b border-gray-100 last:border-0"><td className="px-5 py-3"><Badge tone={info.tone}>{info.label}</Badge></td><td className="px-5 py-3 text-right font-mono text-gray-700">{info.weight}</td><td className="px-5 py-3 text-right font-mono text-gray-700">{info.catchRate}%</td></tr>)}</tbody></table>
        </Card>
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">포켓몬별 확률</h2><p className="mt-1 text-sm text-gray-500">모든 포켓몬은 같은 날 한 번만 출현할 수 있어요.</p></div>
          {visiblePokemon.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">검색한 포켓몬이 없어요.</p> : <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-5 py-3 font-medium">번호</th><th className="px-5 py-3 font-medium">포켓몬</th><th className="px-5 py-3 font-medium">희귀도</th><th className="px-5 py-3 text-right font-medium">출현 가중치</th><th className="px-5 py-3 text-right font-medium">기본 몬스터볼 포획률</th></tr></thead><tbody>{visiblePokemon.map((entry) => {
            const info = RARITY_INFO[entry.rarity];
            const caught = (countByPokemon.get(entry.id) ?? 0) > 0;
            return <tr key={entry.id} className="border-b border-gray-100 last:border-0"><td className="px-5 py-3 font-mono text-gray-500">{String(entry.pokedex_no).padStart(3, "0")}</td><td className="px-5 py-3"><Link href={`/pokedex/${entry.pokedex_no}`} className="flex items-center gap-3 font-medium text-gray-900 hover:text-primary"><img src={entry.image_path} alt={caught ? entry.name_ko : "미획득 포켓몬"} loading="lazy" decoding="async" className={`h-9 w-9 object-contain ${caught ? "" : "grayscale brightness-0 opacity-45"}`} /><span>{entry.name_ko}</span></Link></td><td className="px-5 py-3"><Badge tone={info.tone}>{info.label}</Badge></td><td className="px-5 py-3 text-right font-mono text-gray-700">{entry.spawn_weight}</td><td className="px-5 py-3 text-right font-mono text-gray-700">{Math.round(entry.catch_rate * 100)}%</td></tr>;
          })}</tbody></table>}
        </Card>
      </>}
    </div>
  );
}
