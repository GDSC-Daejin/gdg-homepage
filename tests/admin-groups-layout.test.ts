import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("관리자 그룹 화면", () => {
  it("생성과 목록을 나란한 작업공간으로 보여준다", async () => {
    const [page, form] = await Promise.all([
      readFile("src/app/admin/groups/page.tsx", "utf8"),
      readFile("src/app/admin/groups/GroupForm.tsx", "utf8"),
    ]);

    expect(page).toContain("xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]");
    expect(page).toContain("그룹 목록");
    expect(page).toContain("왼쪽에서 첫 그룹을 만들어 보세요");
    expect(page).toContain("h-12 w-12 text-primary");
    expect(form).toContain("그룹 생성");
    expect(form).toContain('Select name="type"');
    expect(form).toContain('Select name="status"');
    expect(form).toContain('Select name="season"');

    const actions = await readFile("src/app/admin/groups/GroupActions.tsx", "utf8");
    expect(actions).toContain("AssignGroupMemberForm");
    expect(actions).toContain("assignGroupMember");
  });
});
