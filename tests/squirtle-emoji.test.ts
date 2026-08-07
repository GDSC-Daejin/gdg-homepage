import { describe, expect, it } from "vitest";
import { acceptedEmojis, stageEmoji } from "@/lib/squirtle/emoji";

const full = { emoji: "squirtle", emoji_stage2: "wartortle", emoji_stage3: "blastoise" };
const partial = { emoji: "squirtle", emoji_stage2: "wartortle", emoji_stage3: null };
const single = { emoji: "squirtle", emoji_stage2: null, emoji_stage3: null };

describe("stageEmoji", () => {
  it("단계에 맞는 이모지를 고른다", () => {
    expect(stageEmoji(full, 1)).toBe("squirtle");
    expect(stageEmoji(full, 2)).toBe("wartortle");
    expect(stageEmoji(full, 3)).toBe("blastoise");
  });
  it("아직 안 올린 단계는 아래 단계로 내려간다", () => {
    // :blastoise:가 없는데 그 이름으로 reactions.add를 부르면 씨앗이 하나도 안 달린다
    expect(stageEmoji(partial, 3)).toBe("wartortle");
    expect(stageEmoji(single, 3)).toBe("squirtle");
    expect(stageEmoji(single, 2)).toBe("squirtle");
  });
});

describe("acceptedEmojis", () => {
  it("설정된 단계 이모지를 전부 인정한다", () => {
    expect(acceptedEmojis(full)).toEqual(["squirtle", "wartortle", "blastoise"]);
  });
  it("비어 있는 단계는 빼고 중복도 없앤다", () => {
    expect(acceptedEmojis(partial)).toEqual(["squirtle", "wartortle"]);
    expect(acceptedEmojis(single)).toEqual(["squirtle"]);
    expect(acceptedEmojis({ emoji: "squirtle", emoji_stage2: "squirtle", emoji_stage3: null })).toEqual(["squirtle"]);
  });
  it("진화한 뒤에도 이전 단계 이모지를 계속 받는다", () => {
    // 오늘 메시지에는 이전 단계 씨앗만 달려 있다 — 거절하면 아직 안 마신 사람이 인증을 못 한다
    expect(acceptedEmojis(partial)).toContain("squirtle");
  });
});
