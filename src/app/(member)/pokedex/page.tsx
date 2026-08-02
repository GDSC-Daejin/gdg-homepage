import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

type Pokemon = { id: string; pokedex_no: number; name_ko: string; image_path: string };

const DEMO_POKEMON: Pokemon[] = [
  { id: "demo-7", pokedex_no: 7, name_ko: "꼬부기", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png" },
  { id: "demo-25", pokedex_no: 25, name_ko: "피카츄", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" },
  { id: "demo-133", pokedex_no: 133, name_ko: "이브이", image_path: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png" },
];

export default async function PokedexPage() {
  const profile = await requireProfile();
  let pokemon = DEMO_POKEMON;
  let ballCount = 2;
  let caughtIds = ["demo-7"];

  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const [{ data: catalog }, { data: inventory }, { data: throws }] = await Promise.all([
      supabase.from("pokemon_catalog").select("id, pokedex_no, name_ko, image_path").order("pokedex_no"),
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
      {pokemon.length === 0 ? (
        <EmptyState title="도감을 준비하고 있어요" description="도감봇이 활성화되면 포켓몬을 만날 수 있어요." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {pokemon.map((entry) => {
            const count = countByPokemon.get(entry.id) ?? 0;
            return (
              <Card key={entry.id} className={`p-4 text-center ${count ? "" : "grayscale opacity-45"}`}>
                <img src={entry.image_path} alt={count ? entry.name_ko : "미획득 포켓몬"} className={`mx-auto h-20 w-20 object-contain ${count ? "" : "brightness-0"}`} />
                <p className="mt-2 text-sm font-semibold text-gray-900">{count ? entry.name_ko : "???"}</p>
                <p className="mt-1 text-xs text-gray-500">{count ? `${count}마리 보유` : `No. ${entry.pokedex_no}`}</p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
