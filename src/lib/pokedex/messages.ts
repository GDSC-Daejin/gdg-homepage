import { formatKstTime } from "@/lib/format";
import type { PokemonOwnerRanking } from "@/lib/pokedex/ranking";

export type ThrowOutcome = "caught" | "escaped";
export type ThrowRejection = "unlinked" | "invalid" | "expired" | "already_thrown" | "no_ball";

function subjectParticle(name: string) {
  const trimmed = name.trim();
  const code = trimmed.codePointAt(trimmed.length - 1) ?? 0;
  if (code < 0xac00 || code > 0xd7a3) return /[nml]$/i.test(trimmed) ? "이" : "가";
  return (code - 0xac00) % 28 !== 0 ? "이" : "가";
}

export function appearanceMessage(name: string, emoji: string, startsAt: string, endsAt: string, combatPower?: number | null) {
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  const power = combatPower ? ` 전투력 ${combatPower}.` : "";
  return `야생의 ${name}${subjectParticle(name)} 나타났어요!${power} ${minutes}분간 출현해요. ${formatKstTime(endsAt)}까지 :${emoji}:을 눌러 포획해보세요.`;
}

export function throwMessage(slackUserId: string, slackName: string) {
  return `<@${slackUserId}>${subjectParticle(slackName)} 몬스터볼을 던졌어요!`;
}

export function resultMessage(slackUserId: string, slackName: string, pokemonName: string, outcome: ThrowOutcome) {
  return outcome === "caught"
    ? `🎉 <@${slackUserId}>${subjectParticle(slackName)} ${pokemonName} 포획에 성공했어요!`
    : `아쉽게도 <@${slackUserId}>${subjectParticle(slackName)} 던진 몬스터볼에서 ${pokemonName}${subjectParticle(pokemonName)} 도망쳤어요.`;
}

export function rejectionMessage(slackUserId: string, slackName: string, reason: ThrowRejection, pokemonName?: string) {
  if (reason === "expired") return `<@${slackUserId}>${subjectParticle(slackName)} 도착했지만, ${pokemonName ?? "포켓몬"}의 출현은 끝났어요.`;
  if (reason === "already_thrown") return `<@${slackUserId}>은 오늘 몬스터볼 세 개를 모두 던졌어요.`;
  if (reason === "no_ball") return `<@${slackUserId}>의 남은 몬스터볼이 없어요!`;
  if (reason === "unlinked") return `<@${slackUserId}>의 연결된 서비스 계정을 찾지 못했어요.`;
  return null;
}

export function remainingBallsMessage(slackUserId: string, remainingBalls: number) {
  return `<@${slackUserId}>의 남은 몬스터볼: ${remainingBalls}개`;
}

export function ownershipRankingMessage(rankings: PokemonOwnerRanking[]) {
  if (rankings.length === 0) return "🏆 오늘의 포켓몬 도감 랭킹\n아직 포획한 포켓몬이 없어요.";
  return `🏆 오늘의 포켓몬 도감 랭킹\n${rankings.map((ranking, index) => `${index + 1}위 <@${ranking.slackUserId}> · ${ranking.speciesCount}종 보유`).join("\n")}`;
}
