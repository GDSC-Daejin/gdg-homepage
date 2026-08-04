import { describe, expect, it } from "vitest";
import { prioritizeMojisoopPolls } from "@/app/schedule/queries";

describe("prioritizeMojisoopPolls", () => {
  it("모지숲 일정을 다른 일정보다 앞에 둔다", () => {
    const polls = [
      { id: "general-new", is_mojisoop: false },
      { id: "mojisoop", is_mojisoop: true },
      { id: "general-old", is_mojisoop: false },
    ];

    expect(prioritizeMojisoopPolls(polls).map((poll) => poll.id)).toEqual([
      "mojisoop",
      "general-new",
      "general-old",
    ]);
  });
});
