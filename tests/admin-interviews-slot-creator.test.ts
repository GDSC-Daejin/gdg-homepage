import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("관리자 면접 슬롯 생성", () => {
  it("디자인 시스템 DatePicker로 날짜와 시간을 선택한다", async () => {
    const source = await readFile("src/app/admin/interviews/SlotCreator.tsx", "utf8");

    expect(source).toContain('import { DatePicker } from "@/components/DatePicker"');
    expect(source).not.toContain('type="datetime-local"');
    expect(source).toContain("withTime");
    expect(source).toContain('name="starts_at"');
    expect(source).toContain("onChange={(value) => updateSlot(index, value)}");
  });
});
