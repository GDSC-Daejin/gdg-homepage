import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SOURCE = "src/app/admin/places/PlaceManager.tsx";

describe("관리자 장소 화면", () => {
  it("추가 폼을 한 줄로 압축한다", async () => {
    const source = await readFile(SOURCE, "utf8");

    expect(source).toContain("flex flex-col gap-3 sm:flex-row sm:items-end");
    expect(source).toContain("sm:w-56");
    expect(source).toContain("text-xs font-medium text-gray-700");
  });

  it("일괄 변환 버튼을 목록 헤더로 옮기고 대상이 있을 때만 보여준다", async () => {
    const source = await readFile(SOURCE, "utf8");

    expect(source).toContain("pendingCount");
    expect(source).toContain("핀 일괄 변환");
    expect(source).toContain("등록된 장소");
    expect(source).toContain("핀 없음 ");
    // 대상이 0곳이면 버튼과 카운트 조각이 사라진다
    expect(source).toMatch(/pendingCount > 0 &&/);
  });

  it("배지를 3상태로 나누고 핀 있는 장소에는 배지를 달지 않는다", async () => {
    const source = await readFile(SOURCE, "utf8");

    expect(source).toContain("주소 없음");
    expect(source).toContain("bg-warning-soft");
    expect(source).toContain("bg-gray-100 text-gray-500");
    // located 기반의 2상태 배지는 사라진다
    expect(source).not.toContain("핀 있음");
    expect(source).not.toContain("bg-success-soft");
  });

  it("삭제 확인을 Modal 로 처리한다", async () => {
    const source = await readFile(SOURCE, "utf8");

    expect(source).toContain('from "@/components/Modal"');
    expect(source).toContain("deleting");
    expect(source).toContain("장소를 쓰던 이벤트의 장소 정보가 비워질 수 있어요");
    expect(source).toContain('variant="danger"');
    expect(source).not.toContain("confirm(");
  });
});
