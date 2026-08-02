export type PokemonScheduleItem = { id: string; dwellMinutes: number; spawnWeight: number; activityPeriod: "day" | "night" };

export type ScheduledAppearance = {
  pokemonId: string;
  startsAt: Date;
  endsAt: Date;
};

function kstDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function atKst(date: Date, minutes: number) {
  const { year, month, day } = kstDate(date);
  return new Date(Date.UTC(year, month - 1, day, 0, minutes) - 9 * 60 * 60 * 1000);
}

export function planDailyAppearances(
  date: Date,
  pokemon: PokemonScheduleItem[],
  random = Math.random,
): ScheduledAppearance[] {
  const pick = (items: PokemonScheduleItem[], count: number) => {
    if (items.length < count) throw new Error("INSUFFICIENT_POKEMON_FOR_ACTIVITY_PERIOD");
    const choices = [...items];
    return Array.from({ length: count }, () => {
      const target = random() * choices.reduce((sum, item) => sum + item.spawnWeight, 0);
      let total = 0;
      const index = choices.findIndex((item) => {
        total += item.spawnWeight;
        return total > target;
      });
      return choices.splice(index < 0 ? choices.length - 1 : index, 1)[0];
    });
  };

  const dayPokemon = pick(pokemon.filter((item) => item.activityPeriod === "day"), 4);
  const nightPokemon = pick(pokemon.filter((item) => item.activityPeriod === "night"), 1);
  const schedule = (items: PokemonScheduleItem[], startMinute: number, endMinute: number) => {
    let cursor = startMinute;
    return items.map((item, index) => {
      const laterDwellMinutes = items.slice(index + 1).reduce((sum, later) => sum + later.dwellMinutes, 0);
      const latestStart = endMinute - item.dwellMinutes - laterDwellMinutes;
      const startsAt = cursor + Math.floor(random() * (latestStart - cursor + 1));
      cursor = startsAt + item.dwellMinutes;
      return { pokemonId: item.id, startsAt: atKst(date, startsAt), endsAt: atKst(date, cursor) };
    });
  };

  return [
    ...schedule(dayPokemon, 7 * 60, 19 * 60),
    ...schedule(nightPokemon, 19 * 60, 23 * 60),
  ];
}
