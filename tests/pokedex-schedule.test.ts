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
  it("출현 가중치에 따라 다섯 포켓몬을 중복 없이 선택한다", async () => {
    const { planDailyAppearances } = await import("@/lib/pokedex/schedule");
    const appearances = planDailyAppearances(
      new Date("2026-08-02T00:00:00.000Z"),
      [
        { id: "morning", dwellMinutes: 30, spawnWeight: 100, activityPeriod: "morning" },
        { id: "common", dwellMinutes: 30, spawnWeight: 100, activityPeriod: "day" },
        { id: "rare", dwellMinutes: 30, spawnWeight: 1, activityPeriod: "day" },
        { id: "uncommon", dwellMinutes: 30, spawnWeight: 55, activityPeriod: "day" },
        { id: "night", dwellMinutes: 30, spawnWeight: 100, activityPeriod: "night" },
        { id: "night-rare", dwellMinutes: 30, spawnWeight: 1, activityPeriod: "night" },
        { id: "epic", dwellMinutes: 30, spawnWeight: 12, activityPeriod: "day" },
      ],
      () => 0.2,
    );

    expect(appearances).toHaveLength(5);
    expect(new Set(appearances.map((appearance) => appearance.pokemonId)).size).toBe(5);
    expect(appearances.map((appearance) => appearance.pokemonId)).toContain("night");
  });

  it("아침 한 마리·낮 세 마리·저녁 한 마리를 각 시간대에 겹치지 않게 예약한다", async () => {
    const module = await import("@/lib/pokedex/schedule").catch(() => null);
    const planDailyAppearances = module?.planDailyAppearances as
      | ((
          date: Date,
          pokemon: { id: string; dwellMinutes: number; spawnWeight: number; activityPeriod: "morning" | "day" | "night" }[],
          random: () => number,
        ) => ScheduledAppearance[])
      | undefined;

    expect(planDailyAppearances).toBeDefined();
    const appearances = planDailyAppearances?.(
      new Date("2026-08-02T00:00:00.000Z"),
      [
        { id: "pidgey", dwellMinutes: 90, spawnWeight: 100, activityPeriod: "morning" },
        { id: "squirtle", dwellMinutes: 90, spawnWeight: 100, activityPeriod: "day" },
        { id: "charmander", dwellMinutes: 60, spawnWeight: 100, activityPeriod: "day" },
        { id: "pikachu", dwellMinutes: 30, spawnWeight: 100, activityPeriod: "day" },
        { id: "zubat", dwellMinutes: 60, spawnWeight: 100, activityPeriod: "night" },
      ],
      () => 0.5,
    ) ?? [];

    expect(appearances).toHaveLength(5);
    expect(new Set(appearances.map((appearance) => appearance.pokemonId)).size).toBe(5);
    const morningIds = new Set(["pidgey"]);
    const nightIds = new Set(["zubat"]);
    for (const appearance of appearances) {
      const minute = kstMinutes(appearance.startsAt);
      if (morningIds.has(appearance.pokemonId)) {
        expect(minute).toBeGreaterThanOrEqual(7 * 60);
        expect(kstMinutes(appearance.endsAt)).toBeLessThanOrEqual(11 * 60);
      } else if (nightIds.has(appearance.pokemonId)) {
        expect(minute).toBeGreaterThanOrEqual(19 * 60);
        expect(kstMinutes(appearance.endsAt)).toBeLessThanOrEqual(23 * 60);
      } else {
        expect(minute).toBeGreaterThanOrEqual(11 * 60);
        expect(kstMinutes(appearance.endsAt)).toBeLessThanOrEqual(19 * 60);
      }
    }
    for (let index = 1; index < appearances.length; index += 1) {
      expect(appearances[index - 1].endsAt <= appearances[index].startsAt).toBe(true);
    }
  });
});
