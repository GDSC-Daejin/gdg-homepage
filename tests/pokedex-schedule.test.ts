import { describe, expect, it } from "vitest";

type ScheduledAppearance = {
  pokemonId: string;
  startsAt: Date;
  endsAt: Date;
};

function kstMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value) * 60
    + Number(parts.find((part) => part.type === "minute")?.value);
}

describe("도감 일일 출현 예약", () => {
  it("출현 가중치에 따라 세 포켓몬을 중복 없이 선택한다", async () => {
    const { planDailyAppearances } = await import("@/lib/pokedex/schedule");
    const appearances = planDailyAppearances(
      new Date("2026-08-02T00:00:00.000Z"),
      [
        { id: "common", dwellMinutes: 30, spawnWeight: 100 },
        { id: "rare", dwellMinutes: 30, spawnWeight: 1 },
        { id: "uncommon", dwellMinutes: 30, spawnWeight: 55 },
        { id: "epic", dwellMinutes: 30, spawnWeight: 12 },
      ],
      () => 0.2,
    );

    expect(appearances.map((appearance) => appearance.pokemonId)).toEqual(["common", "uncommon", "epic"]);
  });

  it("서로 다른 세 포켓몬을 KST 07:00~23:00 안에서 겹치지 않게 예약한다", async () => {
    const module = await import("@/lib/pokedex/schedule").catch(() => null);
    const planDailyAppearances = module?.planDailyAppearances as
      | ((
          date: Date,
          pokemon: { id: string; dwellMinutes: number; spawnWeight: number }[],
          random: () => number,
        ) => ScheduledAppearance[])
      | undefined;

    expect(planDailyAppearances).toBeDefined();
    const appearances = planDailyAppearances?.(
      new Date("2026-08-02T00:00:00.000Z"),
      [
        { id: "squirtle", dwellMinutes: 90, spawnWeight: 100 },
        { id: "charmander", dwellMinutes: 60, spawnWeight: 100 },
        { id: "pikachu", dwellMinutes: 30, spawnWeight: 100 },
      ],
      () => 0.5,
    ) ?? [];

    expect(appearances).toHaveLength(3);
    expect(new Set(appearances.map((appearance) => appearance.pokemonId)).size).toBe(3);
    for (const appearance of appearances) {
      expect(kstMinutes(appearance.startsAt)).toBeGreaterThanOrEqual(7 * 60);
      expect(kstMinutes(appearance.endsAt)).toBeLessThanOrEqual(23 * 60);
    }
    for (let index = 1; index < appearances.length; index += 1) {
      expect(appearances[index - 1].endsAt <= appearances[index].startsAt).toBe(true);
    }
  });
});
