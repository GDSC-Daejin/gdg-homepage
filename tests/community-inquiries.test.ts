import { describe, expect, it } from "vitest";
import { demoCommunity } from "@/lib/community/demo";
import { DEMO_INQUIRIES, DEMO_INQUIRY_AUTHORS } from "@/lib/demoData";

describe("demoCommunity.inquiries", () => {
  it("둘러보기에서 문의 제출/답변은 성공 형태의 no-op", async () => {
    expect(
      await demoCommunity.inquiries.ops.submit({
        user_id: "demo-m3",
        category: "general",
        title: "t",
        body: "b",
      }),
    ).toEqual({});
    expect(await demoCommunity.inquiries.ops.answer("demo-iq2", "답변")).toEqual({});
  });

  it("reads.list()는 예시 문의 데이터를 그대로 반환한다", async () => {
    expect(await demoCommunity.inquiries.reads.list()).toBe(DEMO_INQUIRIES);
  });

  it("reads.authors()는 요청한 id만 반환한다", async () => {
    const authors = await demoCommunity.inquiries.reads.authors(["demo-m3", "unknown-id"]);
    expect(authors).toEqual([DEMO_INQUIRY_AUTHORS["demo-m3"]]);
  });
});
