import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("어드민 사이드바 프로필 사진", () => {
  it("공용 아바타에 현재 프로필 사진 경로를 전달한다", async () => {
    const layout = await readFile("src/app/admin/layout.tsx", "utf8");

    expect(layout).toContain('import { Avatar } from "@/components/Avatar"');
    expect(layout).toContain("avatarPath={profile.avatar_path}");
  });
});
