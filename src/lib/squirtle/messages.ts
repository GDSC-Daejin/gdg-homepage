import type { Contributor, Stage } from "./types";

export const STAGE_NAMES: Record<Stage, string> = { 1: "꼬부기", 2: "어니부기", 3: "거북왕" };
const MEDALS = ["🥇", "🥈", "🥉"] as const;

export const DAILY_MESSAGES = [
  "꼬북이가 물을 한 잔 마셨어요. 여러분도 한 잔 어때요?", "물 마실 시간이에요! 꼬북이가 컵을 들고 기다리고 있어요.",
  "꼬북이가 목이 마르대요. 같이 한 잔 하실래요?", "오늘도 수분 충전! 꼬북이는 벌써 마셨어요.",
  "똑똑, 꼬북이예요. 물 챙겨 드셨나요?", "꼬북이가 물병을 흔들고 있어요. 신호예요!",
  "한 잔의 물이 오늘의 컨디션을 바꿔요. 꼬북이의 조언입니다.", "꼬북이가 여러분을 기다리며 물을 홀짝이고 있어요.",
  "잠깐! 지금 물 한 잔 하고 오는 거 어때요?", "꼬북이가 오늘도 출석했어요. 여러분은요?",
  "물 마시기 딱 좋은 시간이에요. 꼬북이 보증.", "꼬북이가 컵을 두 개 준비했어요. 하나는 여러분 거예요.",
  "수분 부족은 집중력의 적이래요. 꼬북이가 그러던데요.", "오늘 첫 잔이신가요? 꼬북이는 세 잔째예요.",
  "꼬북이와 함께하는 물 마시기 타임! 지금이에요.",
] as const;

export function dailyMessage(emoji: string, index: number): string {
  return `${DAILY_MESSAGES[index % DAILY_MESSAGES.length]}\n:${emoji}: 눌러서 함께해요!`;
}

export function threadSummary(o: { participants: string[]; total: number; stage: Stage; stage3Threshold: number; emoji: string }): string {
  if (o.participants.length === 0) return "";
  const head = `:${o.emoji}: 오늘 ${o.participants.length}명이 꼬북이와 함께했어요!\n${o.participants.map((id) => `<@${id}>`).join(" ")}`;
  if (o.stage >= 3) return `${head}\n꼬북이는 이미 거북왕이에요 🏆`;
  return `${head}\n거북왕까지 ${Math.max(o.stage3Threshold - o.total, 0)}잔 남았어요`;
}

function ranking(top3: Contributor[]): string {
  return top3.map((c, i) => `${MEDALS[i]} <@${c.slack_user_id}> ${c.count}잔`).join("\n");
}

export function evolutionMessage(o: { stage: Stage; total: number; top3: Contributor[]; participantCount: number }): string {
  return [`🎉 꼬북이가 ${STAGE_NAMES[o.stage]}(으)로 진화했어요!`, `   이번 시즌 ${o.total}잔 달성 🏆`, "", ranking(o.top3), "", `함께해준 ${o.participantCount}명 모두 고마워요!`].join("\n");
}

export function seasonEndMessage(o: { stage: Stage; total: number; top3: Contributor[]; bonuses: readonly [number, number, number]; emoji: string }): string {
  const bonusLines = o.top3.map((c, i) => `${MEDALS[i]} <@${c.slack_user_id}> ${c.count}잔 · ${o.bonuses[i]}포인트`).join("\n");
  return ["🏁 이번 시즌이 끝났어요!", `   최종 ${STAGE_NAMES[o.stage]} · 총 ${o.total}잔`, "", bonusLines, "", `내일부터 새 시즌이 꼬부기로 시작해요. 다시 키워봐요 :${o.emoji}:`].join("\n");
}
