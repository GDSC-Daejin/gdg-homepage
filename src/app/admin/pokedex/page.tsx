import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { isDemoMode } from "@/lib/demo";
import { displayName, formatKst } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { OverviewTabs } from "../OverviewTabs";

type Catch = { user_id: string; pokemon_id: string; created_at: string };
type Appearance = { pokemon_id: string; starts_at: string };
type Profile = { id: string; name: string; nickname: string | null; avatar_path: string | null };
type Pokemon = { id: string; pokedex_no: number; name_ko: string; image_path: string };

const DEMO_PROFILES: Profile[] = [
  { id: "jaden", name: "옥지훈", nickname: "제이든", avatar_path: null },
  { id: "yuki", name: "유키", nickname: null, avatar_path: null },
  { id: "momo", name: "모모", nickname: null, avatar_path: null },
];
const DEMO_POKEMON: Pokemon[] = [
  { id: "squirtle", pokedex_no: 7, name_ko: "꼬부기", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png" },
  { id: "pikachu", pokedex_no: 25, name_ko: "피카츄", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" },
  { id: "eevee", pokedex_no: 133, name_ko: "이브이", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png" },
];
const DEMO_APPEARANCES: Appearance[] = [
  { pokemon_id: "squirtle", starts_at: "2026-08-02T01:00:00.000Z" },
  { pokemon_id: "pikachu", starts_at: "2026-08-01T01:00:00.000Z" },
  { pokemon_id: "squirtle", starts_at: "2026-07-31T01:00:00.000Z" },
  { pokemon_id: "eevee", starts_at: "2026-07-30T01:00:00.000Z" },
];
const DEMO_CATCHES: Catch[] = [
  { user_id: "jaden", pokemon_id: "squirtle", created_at: "2026-08-02T01:00:00.000Z" },
  { user_id: "jaden", pokemon_id: "pikachu", created_at: "2026-08-01T01:00:00.000Z" },
  { user_id: "jaden", pokemon_id: "squirtle", created_at: "2026-07-31T01:00:00.000Z" },
  { user_id: "yuki", pokemon_id: "squirtle", created_at: "2026-07-30T01:00:00.000Z" },
  { user_id: "momo", pokemon_id: "eevee", created_at: "2026-07-29T01:00:00.000Z" },
];

export const dynamic = "force-dynamic";

export default async function AdminPokedexPage() {
  let catches = DEMO_CATCHES;
  let profiles = DEMO_PROFILES;
  let pokemon = DEMO_POKEMON;
  let appearances = DEMO_APPEARANCES;

  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const [{ data: throws }, { data: catalog }, { data: appearanceRows }] = await Promise.all([
      supabase.from("pokemon_throws").select("user_id, pokemon_id, created_at").eq("outcome", "caught").order("created_at", { ascending: false }),
      supabase.from("pokemon_catalog").select("id, pokedex_no, name_ko, image_path").order("pokedex_no"),
      supabase.from("pokemon_appearances").select("pokemon_id, starts_at").in("status", ["posted", "expired"]).order("starts_at", { ascending: false }),
    ]);
    catches = (throws ?? []) as Catch[];
    pokemon = (catalog ?? []) as Pokemon[];
    appearances = (appearanceRows ?? []) as Appearance[];
    const userIds = [...new Set(catches.map((entry) => entry.user_id))];
    if (userIds.length) {
      const { data } = await supabase.from("profiles").select("id, name, nickname, avatar_path").in("id", userIds);
      profiles = (data ?? []) as Profile[];
    } else {
      profiles = [];
    }
  }

  const names = new Map(profiles.map((profile) => [profile.id, displayName(profile.name, profile.nickname)]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const pokemonById = new Map(pokemon.map((entry) => [entry.id, entry]));
  const userCounts = new Map<string, number>();
  const pokemonCounts = new Map<string, number>();
  for (const entry of catches) {
    userCounts.set(entry.user_id, (userCounts.get(entry.user_id) ?? 0) + 1);
    pokemonCounts.set(entry.pokemon_id, (pokemonCounts.get(entry.pokemon_id) ?? 0) + 1);
  }
  const userRanking = [...userCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const pokemonRanking = [...pokemonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topUser = userRanking[0];
  const topPokemon = pokemonRanking[0];
  const appearanceCounts = new Map<string, number>();
  for (const entry of appearances) appearanceCounts.set(entry.pokemon_id, (appearanceCounts.get(entry.pokemon_id) ?? 0) + 1);
  const appearedPokemon = pokemon.filter((entry) => appearanceCounts.has(entry.id));

  return (
    <div className="flex flex-col gap-6">
      <OverviewTabs />
      <PageHeader title="도감 현황" description="포획 기록과 인기 포켓몬을 한눈에 확인해요." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="총 포획 성공" value={`${catches.length}마리`} />
        <StatCard label="포획한 회원" value={`${userCounts.size}명`} />
        <StatCard label="가장 많이 잡은 회원" value={topUser ? names.get(topUser[0]) ?? "(탈퇴한 회원)" : "-"} hint={topUser ? `${topUser[1]}마리 포획` : undefined} />
        <StatCard label="가장 많이 잡힌 포켓몬" value={topPokemon ? pokemonById.get(topPokemon[0])?.name_ko ?? "-" : "-"} hint={topPokemon ? `${topPokemon[1]}마리 포획` : undefined} emphasis={Boolean(topPokemon)} />
      </div>

      {catches.length === 0 ? <EmptyState title="아직 포획 기록이 없어요" description="회원이 포켓몬을 잡으면 현황을 보여줘요." /> : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <RankingCard title="포획 랭킹" rows={userRanking.map(([id, count]) => ({ label: names.get(id) ?? "(탈퇴한 회원)", count }))} />
            <RankingCard title="인기 포켓몬" rows={pokemonRanking.map(([id, count]) => ({ label: pokemonById.get(id)?.name_ko ?? "알 수 없는 포켓몬", count, imagePath: pokemonById.get(id)?.image_path }))} />
          </div>
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-6"><h2 className="text-sm font-semibold text-gray-900">회원별 포획 기록</h2><p className="text-sm text-gray-500">{catches.length}건</p></div>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-4 py-3 font-medium">회원</th><th className="px-4 py-3 font-medium">포획 포켓몬</th><th className="px-4 py-3 font-medium">포획 시각</th></tr></thead>
                <tbody>{catches.map((entry, index) => {
                  const profile = profilesById.get(entry.user_id);
                  const name = names.get(entry.user_id) ?? "(탈퇴한 회원)";
                  return <tr key={`${entry.user_id}-${entry.created_at}-${index}`} className="border-b border-gray-100 last:border-0 transition-colors duration-100 hover:bg-gray-50"><td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar name={profile?.name ?? name} avatarPath={profile?.avatar_path} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary" /><Link href={`/admin/members/${entry.user_id}`} className="font-medium text-primary hover:underline">{name}</Link></div></td><td className="px-4 py-4 text-gray-700">{pokemonById.get(entry.pokemon_id)?.name_ko ?? "알 수 없는 포켓몬"}</td><td className="px-4 py-4 text-gray-500">{formatKst(entry.created_at)}</td></tr>;
                })}</tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-gray-200 px-4 py-3"><p className="text-sm font-semibold text-gray-900">최근 출현</p></div>
          {appearances.length === 0 ? <div className="p-6"><EmptyState title="아직 출현 기록이 없어요" /></div> : (
            <table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-4 py-3 font-medium">포켓몬</th><th className="px-4 py-3 font-medium">출현 시각</th></tr></thead><tbody>{appearances.slice(0, 10).map((entry, index) => <tr key={`${entry.pokemon_id}-${entry.starts_at}-${index}`} className="border-b border-gray-100 last:border-0"><td className="px-4 py-3 font-medium text-gray-900">{pokemonById.get(entry.pokemon_id)?.name_ko ?? "알 수 없는 포켓몬"}</td><td className="px-4 py-3 text-gray-500">{formatKst(entry.starts_at)}</td></tr>)}</tbody></table>
          )}
        </Card>
        <Card>
          <p className="text-sm font-semibold text-gray-900">역대 출현 포켓몬</p>
          <p className="mt-1 text-xs text-gray-400">총 {appearedPokemon.length}종</p>
          {appearedPokemon.length === 0 ? <div className="mt-6"><EmptyState title="아직 출현 기록이 없어요" /></div> : (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">{appearedPokemon.map((entry) => <div key={entry.id} className="rounded-lg bg-gray-50 p-2 text-center"><img src={entry.image_path} alt="" className="mx-auto h-10 w-10 object-contain" /><p className="mt-1 truncate text-xs font-medium text-gray-800">{entry.name_ko}</p><p className="text-xs text-gray-500">{appearanceCounts.get(entry.id)}회</p></div>)}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function RankingCard({ title, rows }: { title: string; rows: { label: string; count: number; imagePath?: string }[] }) {
  return (
    <Card>
      <p className="mb-4 text-sm font-semibold text-gray-900">{title}</p>
      <ol className="space-y-3">{rows.map((row, index) => <li key={row.label} className="flex items-center gap-3"><span className="w-5 text-sm font-semibold text-gray-400">{index + 1}</span>{row.imagePath && <img src={row.imagePath} alt="" className="h-8 w-8 object-contain" />}<span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{row.label}</span><span className="text-sm tabular-nums text-gray-500">{row.count}마리</span></li>)}</ol>
    </Card>
  );
}
