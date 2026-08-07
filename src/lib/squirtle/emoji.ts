import type { Stage } from "./types";

export type StageEmojiConfig = {
  emoji: string;
  emoji_stage2: string | null;
  emoji_stage3: string | null;
};

function ladder(config: StageEmojiConfig): readonly (string | null)[] {
  return [config.emoji, config.emoji_stage2, config.emoji_stage3];
}

/**
 * 그 단계에서 봇이 안내하고 선점할 이모지.
 * 해당 단계가 비어 있으면 아래 단계로 내려간다 — 아직 안 올린 이모지로 reactions.add를 부르면
 * invalid_name으로 실패하고, 그날 메시지에 씨앗이 하나도 안 달린다.
 */
export function stageEmoji(config: StageEmojiConfig, stage: Stage): string {
  const rungs = ladder(config);
  for (let i = stage - 1; i >= 0; i -= 1) {
    const name = rungs[i];
    if (name) return name;
  }
  return config.emoji;
}

/**
 * 인증으로 인정하는 이모지 전부. 설정된 단계 이모지는 현재 단계와 무관하게 전부 받는다.
 * 진화 직후 이전 단계 이모지를 누른 사람을 떨어뜨리지 않기 위해서다.
 * 한 사람이 여러 개를 눌러도 (season_id, user_id, checked_on) 유니크가 1잔으로 묶는다.
 */
export function acceptedEmojis(config: StageEmojiConfig): string[] {
  return [...new Set(ladder(config).filter((name): name is string => Boolean(name)))];
}
