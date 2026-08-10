import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { gameAmountBlocks, gameGuessBlocks, shopBlocks, stockQuantityBlocks } from "@/lib/trainer-market/blocks";

it("매수 수량 버튼은 한 블록 안에서 서로 다른 action_id를 쓴다", () => {
  const elements = stockQuantityBlocks("SILPH")[0].elements as Array<{ action_id: string }>;
  expect(new Set(elements.map((element) => element.action_id)).size).toBe(elements.length);
});

it("선택 버튼은 한 블록 안에서 서로 다른 action_id를 쓴다", () => {
  for (const block of [gameAmountBlocks()[0], gameGuessBlocks(10)[0], shopBlocks()[0]]) {
    const elements = block.elements as Array<{ action_id: string }>;
    expect(new Set(elements.map((element) => element.action_id)).size).toBe(elements.length);
  }
});

it("버튼 응답은 원본 응원판을 교체하지 않는다", () => {
  expect(readFileSync("src/app/api/slack/trainer/actions/route.ts", "utf8")).toContain("replace_original: false");
});
