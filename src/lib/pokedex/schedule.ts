export type PokemonScheduleItem = { id: string; dwellMinutes: number };

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
  if (pokemon.length < 3) throw new Error("AT_LEAST_THREE_POKEMON_REQUIRED");

  const choices = [...pokemon];
  const selected = Array.from({ length: 3 }, () => choices.splice(Math.floor(random() * choices.length), 1)[0]);
  const closingMinute = 23 * 60;
  let cursor = 7 * 60;

  return selected.map((item, index) => {
    const laterDwellMinutes = selected.slice(index + 1).reduce((sum, later) => sum + later.dwellMinutes, 0);
    const latestStart = closingMinute - item.dwellMinutes - laterDwellMinutes;
    const startMinute = cursor + Math.floor(random() * (latestStart - cursor + 1));
    cursor = startMinute + item.dwellMinutes;
    return {
      pokemonId: item.id,
      startsAt: atKst(date, startMinute),
      endsAt: atKst(date, cursor),
    };
  });
}
