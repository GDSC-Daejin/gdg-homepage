import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { requireProfile } from "@/lib/auth";
import { pokemonDescription } from "@/lib/pokedex/catalog";
import { isDemoMode } from "@/lib/demo";
import { displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Pokemon = { id: string; pokedex_no: number; name_ko: string; image_path: string };
type Catch = { ball_slug: string; caught_at: string; appearance: { combat_power: number | null } | null };
type CatchRow = { ball_slug: string; created_at: string; appearance: { combat_power: number | null } | null };
type Ball = { slug: string; name_ko: string };
type Catcher = { user_id: string; name: string; nickname: string | null; avatar_path: string | null; ball_slug: string; caught_at: string; combat_power: number | null };

const DEMO_POKEMON: Pokemon[] = [
  { id: "demo-7", pokedex_no: 7, name_ko: "꼬부기", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png" },
  { id: "demo-25", pokedex_no: 25, name_ko: "피카츄", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" },
  { id: "demo-133", pokedex_no: 133, name_ko: "이브이", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png" },
];

export default async function PokemonDetailPage({ params }: { params: Promise<{ pokedexNo: string }> }) {
  const profile = await requireProfile();
  const { pokedexNo: rawPokedexNo } = await params;
  const pokedexNo = Number(rawPokedexNo);
  if (!Number.isInteger(pokedexNo)) notFound();

  let pokemon = DEMO_POKEMON.find((entry) => entry.pokedex_no === pokedexNo) ?? null;
  let myCatches: Catch[] = pokemon?.id === "demo-7" ? [{ ball_slug: "poke_ball", caught_at: "2026-08-02T01:00:00.000Z", appearance: { combat_power: 542 } }] : [];
  let balls: Ball[] = [{ slug: "poke_ball", name_ko: "몬스터볼" }];
  let catchers: Catcher[] = pokemon?.id === "demo-7" ? [{ user_id: "demo-user", name: profile.name, nickname: profile.nickname, avatar_path: profile.avatar_path ?? null, ball_slug: "poke_ball", caught_at: "2026-08-02T01:00:00.000Z", combat_power: 542 }] : [];

  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const { data } = await supabase.from("pokemon_catalog").select("id, pokedex_no, name_ko, image_path").eq("pokedex_no", pokedexNo).maybeSingle();
    pokemon = (data as Pokemon | null) ?? null;
    if (pokemon) {
      const [{ data: catches }, { data: ballTypes }, { data: catcherRows }] = await Promise.all([
        supabase.from("pokemon_throws").select("ball_slug, created_at, appearance:pokemon_appearances(combat_power)").eq("user_id", profile.id).eq("pokemon_id", pokemon.id).eq("outcome", "caught").order("created_at", { ascending: false }).returns<CatchRow[]>(),
        supabase.from("pokemon_ball_types").select("slug, name_ko"),
        supabase.rpc("pokedex_catchers", { p_pokemon: pokemon.id }),
      ]);
      myCatches = (catches ?? []).map((catchRecord) => ({
        ball_slug: catchRecord.ball_slug,
        caught_at: catchRecord.created_at,
        appearance: catchRecord.appearance,
      }));
      balls = (ballTypes ?? []) as Ball[];
      catchers = (catcherRows ?? []) as Catcher[];
    }
  }
  if (!pokemon) notFound();

  const ballNames = new Map(balls.map((ball) => [ball.slug, ball.name_ko]));
  const myBallCounts = new Map<string, number>();
  for (const catchRecord of myCatches) myBallCounts.set(catchRecord.ball_slug, (myBallCounts.get(catchRecord.ball_slug) ?? 0) + 1);
  const caught = myCatches.length > 0;
  let previousPower: number | null = null;
  let rank = 0;
  const rankedCatchers = catchers.map((catcher, index) => {
    if (catcher.combat_power !== null && catcher.combat_power !== previousPower) rank = index + 1;
    previousPower = catcher.combat_power;
    return { ...catcher, rank: catcher.combat_power === null ? null : rank };
  });

  return (
    <div>
      <PageHeader title={caught ? pokemon.name_ko : "???"} description={`No. ${String(pokemon.pokedex_no).padStart(3, "0")}`} action={<Link href="/pokedex" className="text-sm font-medium text-primary hover:underline">도감으로 돌아가기</Link>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_1.35fr]">
        <Card className="flex flex-col items-center justify-center bg-primary-soft p-8 text-center">
          <Image src={pokemon.image_path} alt={caught ? pokemon.name_ko : "미획득 포켓몬"} width={224} height={224} preload className={`h-48 w-48 object-contain sm:h-56 sm:w-56 ${caught ? "" : "grayscale brightness-0 opacity-45"}`} />
          <p className="mt-4 text-sm font-semibold text-primary">No. {String(pokemon.pokedex_no).padStart(3, "0")}</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">{caught ? pokemon.name_ko : "???"}</h2>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-gray-900">포켓몬 설명</p>
          <p className="mt-3 whitespace-pre-line leading-7 text-gray-600">{caught ? pokemonDescription(pokemon.pokedex_no, pokemon.name_ko) : "???"}</p>
          <div className="mt-8 border-t border-gray-100 pt-6">
            <p className="text-sm font-semibold text-gray-900">내가 사용한 볼</p>
            {myBallCounts.size === 0 ? <p className="mt-2 text-sm text-gray-500">아직 이 포켓몬을 포획하지 못했어요.</p> : <div className="mt-3 flex flex-wrap gap-2">{[...myBallCounts.entries()].map(([slug, count]) => <span key={slug} className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary">{ballNames.get(slug) ?? slug} × {count}</span>)}</div>}
          </div>
          {myCatches.length > 0 && <div className="mt-6 border-t border-gray-100 pt-6"><p className="text-sm font-semibold text-gray-900">내가 포획한 전투력</p><div className="mt-3 flex flex-wrap gap-2">{myCatches.map((catchRecord) => <span key={`${catchRecord.caught_at}-${catchRecord.ball_slug}`} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700">{catchRecord.appearance?.combat_power ?? "기록 없음"}</span>)}</div></div>}
        </Card>
      </div>
      <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card dark:bg-gray-100">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4"><h2 className="text-sm font-semibold text-gray-900">포획한 회원 전투력 랭킹</h2><p className="text-sm text-gray-500">{rankedCatchers.length}건</p></div>
        {rankedCatchers.length === 0 ? <div className="p-6"><EmptyState title="아직 포획한 회원이 없어요" description="첫 포획에 도전해보세요." /></div> : <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-5 py-3 font-medium">순위</th><th className="px-5 py-3 font-medium">회원</th><th className="px-5 py-3 text-right font-medium">전투력</th><th className="px-5 py-3 font-medium">사용한 볼</th></tr></thead><tbody>{rankedCatchers.map((catcher) => <tr key={`${catcher.user_id}-${catcher.caught_at}`} className="border-b border-gray-100 last:border-0"><td className="px-5 py-3 font-semibold text-primary">{catcher.rank ? `${catcher.rank}위` : "-"}</td><td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={catcher.name} avatarPath={catcher.avatar_path} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary" /><p className="font-medium text-gray-900">{displayName(catcher.name, catcher.nickname)}</p></div></td><td className="px-5 py-3 text-right font-mono font-semibold text-gray-900">{catcher.combat_power ?? "기록 없음"}</td><td className="px-5 py-3 text-gray-600">{ballNames.get(catcher.ball_slug) ?? catcher.ball_slug}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
