import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("어드민 사이드바 프로필 사진", () => {
  it("공용 아바타에 현재 프로필 사진 경로를 전달한다", async () => {
    // 사이드바는 어드민·조율 화면이 함께 쓰려고 layout에서 따로 빼둔 파일이다.
    const sidebar = await readFile("src/app/admin/AdminSidebar.tsx", "utf8");

    expect(sidebar).toContain('import { Avatar } from "@/components/Avatar"');
    expect(sidebar).toContain("avatarPath={profile.avatar_path}");
  });
});
