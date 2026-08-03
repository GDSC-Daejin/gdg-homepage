"use client";

import dynamic from "next/dynamic";
import type { DuelMember, OwnedBattlePokemon, PokemonDuel } from "@/lib/pokedex/duel";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";

const DuelPanel = dynamic(() => import("./DuelPanel").then((module) => module.DuelPanel));
const RankingLeaguePanel = dynamic(() => import("./RankingLeaguePanel").then((module) => module.RankingLeaguePanel));

type Props =
  | { kind: "duel"; profileId: string; members: DuelMember[]; ownedPokemon: OwnedBattlePokemon[]; duels: PokemonDuel[] }
  | { kind: "ranking"; profileId: string; state: RankingLeagueState };

export function PokedexBattleTab(props: Props) {
  return props.kind === "duel"
    ? <DuelPanel profileId={props.profileId} members={props.members} ownedPokemon={props.ownedPokemon} duels={props.duels} />
    : <RankingLeaguePanel profileId={props.profileId} state={props.state} />;
}
