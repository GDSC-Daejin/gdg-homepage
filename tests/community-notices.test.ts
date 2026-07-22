import { describe, expect, it } from "vitest";
import { demoCommunity } from "@/lib/community/demo";
import { DEMO_NOTICES } from "@/lib/demoData";

describe("demoCommunity.notices", () => {
  it("둘러보기에서 작성/수정/삭제는 성공 형태의 no-op", async () => {
    expect(
      await demoCommunity.notices.ops.create({ title: "t", body: "b", created_by: "demo-m1" }),
    ).toEqual({});
    expect(await demoCommunity.notices.ops.update("demo-n1", { title: "t", body: "b" })).toEqual(
      {},
    );
    expect(await demoCommunity.notices.ops.delete("demo-n1")).toEqual({});
  });

  it("둘러보기에서 발행은 notice를 안 돌려줘 액션이 실제 슬랙 전송을 건너뛰게 한다", async () => {
    const result = await demoCommunity.notices.ops.publish("demo-n1");
    expect(result).toEqual({});
    expect(result.notice).toBeUndefined();
  });

  it("reads.list()는 예시 공지 데이터를 그대로 반환한다", async () => {
    expect(await demoCommunity.notices.reads.list()).toBe(DEMO_NOTICES);
  });

  it("reads.get()은 없는 id면 null을 반환한다(실제 어댑터와 동일 계약)", async () => {
    expect(await demoCommunity.notices.reads.get("demo-n1")).toEqual(
      DEMO_NOTICES.find((n) => n.id === "demo-n1"),
    );
    expect(await demoCommunity.notices.reads.get("no-such-id")).toBeNull();
  });
});
