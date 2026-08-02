export type ThrowOutcome = "caught" | "escaped";

export function appearanceMessage(name: string, emoji: string) {
  return `야생의 ${name}가 나타났어요! :${emoji}:를 눌러 포획해보세요.`;
}

export function throwMessage(slackUserId: string) {
  return `<@${slackUserId}>이 몬스터볼을 던졌어요!`;
}

export function resultMessage(slackUserId: string, pokemonName: string, outcome: ThrowOutcome) {
  return outcome === "caught"
    ? `🎉 <@${slackUserId}>이 ${pokemonName} 포획에 성공했어요!`
    : `아쉽게도 ${pokemonName}가 도망쳤어요.`;
}
