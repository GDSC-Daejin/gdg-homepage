import { findAcceptedDuel, type PokemonDuel } from "@/lib/pokedex/duel";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const participant = {
  userId: "user-1",
  name: "트레이너",
  nickname: null,
  avatarPath: null,
  battleType: "normal" as const,
  pokemonName: "피카츄",
  imagePath: "/pikachu.png",
  combatPower: 100,
};

function duel(id: string, status: PokemonDuel["status"]): PokemonDuel {
  return { id, status, createdAt: "2026-08-03T00:00:00.000Z", winnerId: null, challenger: participant, opponent: participant };
}

describe("결투 수락 수신", () => {
  it("신청자가 기다리던 결투가 수락되면 애니메이션에 넘길 결과를 찾는다", () => {
    expect(findAcceptedDuel(new Set(["duel-1"]), [
      duel("duel-1", "accepted"),
      duel("duel-2", "pending"),
    ])).toMatchObject({ id: "duel-1", status: "accepted" });
  });

  it("수락 이벤트는 참가자에게만 Realtime으로 전달한다", async () => {
    const migration = await readFile("supabase/migrations/0081_pokedex_duel_realtime.sql", "utf8");

    expect(migration).toContain("grant select on public.pokemon_duels to authenticated");
    expect(migration).toContain('create policy "pokemon_duels: participants read"');
    expect(migration).toContain("auth.uid() = challenger_id or auth.uid() = opponent_id");
    expect(migration).toContain("alter publication supabase_realtime add table public.pokemon_duels");
  });
});
