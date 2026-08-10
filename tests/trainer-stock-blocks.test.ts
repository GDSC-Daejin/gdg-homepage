import { expect, it } from "vitest";
import { stockQuantityBlocks } from "@/lib/trainer-market/blocks";

it("매수 수량 버튼은 한 블록 안에서 서로 다른 action_id를 쓴다", () => {
  const elements = stockQuantityBlocks("SILPH")[0].elements as Array<{ action_id: string }>;
  expect(new Set(elements.map((element) => element.action_id)).size).toBe(elements.length);
});
