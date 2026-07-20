import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("관리자 모집 설정 날짜", () => {
  it("디자인 시스템 DatePicker로 기간을 선택한다", async () => {
    const [form, picker] = await Promise.all([
      readFile("src/app/admin/settings/SettingsForm.tsx", "utf8"),
      readFile("src/components/DatePicker.tsx", "utf8"),
    ]);

    expect(form).toContain('import { DatePicker } from "@/components/DatePicker"');
    expect(form).not.toContain('type="date"');
    expect(form).toContain("max={end || undefined}");
    expect(form).toContain("min={start || undefined}");
    expect(picker).toContain("min?: string");
    expect(picker).toContain("max?: string");
    expect(picker).toContain("onChange?: (value: string) => void");
  });
});
