import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

type Pokemon = { id: string; pokedex_no: number; name_ko: string; image_path: string; rarity: Rarity; spawn_weight: number; catch_rate: number };
type Rarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary";

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

export default async function PokedexPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const profile = await requireProfile();
  const tab = (await searchParams).tab === "probabilities" ? "probabilities" : "collection";
  let pokemon = DEMO_POKEMON;
  let ballCount = 2;
  let caughtIds = ["demo-7"];

  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const [{ data: catalog }, { data: inventory }, { data: throws }] = await Promise.all([
      supabase.from("pokemon_catalog").select("id, pokedex_no, name_ko, image_path, rarity, spawn_weight, catch_rate").order("pokedex_no"),
      supabase.from("pokemon_ball_inventory").select("quantity").eq("user_id", profile.id).eq("ball_slug", "poke_ball").maybeSingle(),
      supabase.from("pokemon_throws").select("pokemon_id").eq("user_id", profile.id).eq("outcome", "caught"),
    ]);
    pokemon = (catalog ?? []) as Pokemon[];
    ballCount = inventory?.quantity ?? 0;
    caughtIds = ((throws ?? []) as { pokemon_id: string }[]).map((throwRecord) => throwRecord.pokemon_id);
  }

  const countByPokemon = new Map<string, number>();
  for (const id of caughtIds) countByPokemon.set(id, (countByPokemon.get(id) ?? 0) + 1);
  const collected = countByPokemon.size;

  return (
    <div>
      <PageHeader title="포켓몬 도감" description="슬랙에서 몬스터볼을 던져 포켓몬을 모아보세요." />
      <nav aria-label="포켓몬 도감" className="mb-6 flex gap-1 border-b border-gray-200">
        <Link href="/pokedex" aria-current={tab === "collection" ? "page" : undefined} className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${tab === "collection" ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>내 도감</Link>
        <Link href="/pokedex?tab=probabilities" aria-current={tab === "probabilities" ? "page" : undefined} className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${tab === "probabilities" ? "bg-primary-soft text-primary" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}>확률표</Link>
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
          return <Link key={entry.id} href={`/pokedex/${entry.pokedex_no}`} className="rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"><Card className={`p-4 text-center transition-transform hover:-translate-y-0.5 ${count ? "" : "grayscale opacity-45"}`}><img src={entry.image_path} alt={count ? entry.name_ko : "미획득 포켓몬"} className={`mx-auto h-20 w-20 object-contain ${count ? "" : "brightness-0"}`} /><p className="mt-2 text-sm font-semibold text-gray-900">{count ? entry.name_ko : "???"}</p><p className="mt-1 text-xs text-gray-500">{count ? `${count}마리 보유` : `No. ${entry.pokedex_no}`}</p></Card></Link>;
        })}</div>}
      </> : <>
        <Card className="mb-6 overflow-x-auto p-0">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">희귀도별 확률</h2><p className="mt-1 text-sm text-gray-500">하루 3회, 가중치 비례·중복 없이 선정돼요.</p></div>
          <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-5 py-3 font-medium">희귀도</th><th className="px-5 py-3 text-right font-medium">출현 가중치</th><th className="px-5 py-3 text-right font-medium">기본 몬스터볼 포획률</th></tr></thead><tbody>{Object.entries(RARITY_INFO).map(([rarity, info]) => <tr key={rarity} className="border-b border-gray-100 last:border-0"><td className="px-5 py-3"><Badge tone={info.tone}>{info.label}</Badge></td><td className="px-5 py-3 text-right font-mono text-gray-700">{info.weight}</td><td className="px-5 py-3 text-right font-mono text-gray-700">{info.catchRate}%</td></tr>)}</tbody></table>
        </Card>
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-gray-100 px-5 py-4"><h2 className="font-semibold text-gray-900">포켓몬별 확률</h2><p className="mt-1 text-sm text-gray-500">모든 포켓몬은 같은 날 한 번만 출현할 수 있어요.</p></div>
          <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-5 py-3 font-medium">번호</th><th className="px-5 py-3 font-medium">포켓몬</th><th className="px-5 py-3 font-medium">희귀도</th><th className="px-5 py-3 text-right font-medium">출현 가중치</th><th className="px-5 py-3 text-right font-medium">기본 몬스터볼 포획률</th></tr></thead><tbody>{pokemon.map((entry) => {
            const info = RARITY_INFO[entry.rarity];
            const caught = (countByPokemon.get(entry.id) ?? 0) > 0;
            return <tr key={entry.id} className="border-b border-gray-100 last:border-0"><td className="px-5 py-3 font-mono text-gray-500">{String(entry.pokedex_no).padStart(3, "0")}</td><td className="px-5 py-3"><Link href={`/pokedex/${entry.pokedex_no}`} className="flex items-center gap-3 font-medium text-gray-900 hover:text-primary"><img src={entry.image_path} alt={caught ? entry.name_ko : "미획득 포켓몬"} className={`h-9 w-9 object-contain ${caught ? "" : "grayscale brightness-0 opacity-45"}`} /><span>{entry.name_ko}</span></Link></td><td className="px-5 py-3"><Badge tone={info.tone}>{info.label}</Badge></td><td className="px-5 py-3 text-right font-mono text-gray-700">{entry.spawn_weight}</td><td className="px-5 py-3 text-right font-mono text-gray-700">{Math.round(entry.catch_rate * 100)}%</td></tr>;
          })}</tbody></table>
        </Card>
      </>}
    </div>
  );
}
