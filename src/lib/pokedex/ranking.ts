export type CaughtPokemon = { userId: string; pokemonId: string };
export type PokemonOwnerRanking = { slackUserId: string; speciesCount: number; totalCatches: number };

export function pokemonOwnershipRanking(catches: CaughtPokemon[], slackUserIds: Map<string, string>) {
  const byUser = new Map<string, { species: Set<string>; totalCatches: number }>();
  for (const catchRecord of catches) {
    if (!slackUserIds.has(catchRecord.userId)) continue;
    const summary = byUser.get(catchRecord.userId) ?? { species: new Set<string>(), totalCatches: 0 };
    summary.species.add(catchRecord.pokemonId);
    summary.totalCatches += 1;
    byUser.set(catchRecord.userId, summary);
  }

  return [...byUser.entries()]
    .map(([userId, summary]) => ({ slackUserId: slackUserIds.get(userId)!, speciesCount: summary.species.size, totalCatches: summary.totalCatches }))
    .sort((a, b) => b.speciesCount - a.speciesCount || b.totalCatches - a.totalCatches || a.slackUserId.localeCompare(b.slackUserId))
    .slice(0, 3);
}
