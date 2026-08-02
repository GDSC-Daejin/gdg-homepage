import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const PAGE = "src/app/admin/places/[id]/page.tsx";
const ACTIONS = "src/actions/place.ts";
const MANAGER = "src/app/admin/places/PlaceManager.tsx";
const MIGRATION = "supabase/migrations/0052_place_notes.sql";

describe("관리자 장소 상세", () => {
  it("목록에서 장소명을 누르면 상세로 간다", async () => {
    const source = await readFile(MANAGER, "utf8");
    expect(source).toContain("/admin/places/${place.id}");
  });

  it("상세가 지도·운영 메모·이벤트 목록을 담는다", async () => {
    const source = await readFile(PAGE, "utf8");
    expect(source).toContain('from "@/components/NaverMap"');
    expect(source).toContain("PlaceNotesForm");
    expect(source).toContain('eq("place_id"');
    expect(source).toContain("notFound()");
  });

  it("메모는 별도 액션이라 목록 인라인 수정이 메모를 지우지 않는다", async () => {
    const source = await readFile(ACTIONS, "utf8");
    expect(source).toContain("updatePlaceNotes");
    // readPlaceForm은 목록 인라인 폼(notes 입력 없음)의 파서다
    const parser = source.slice(
      source.indexOf("function readPlaceForm"),
      source.indexOf("export async function createPlace"),
    );
    expect(parser).not.toContain("notes");
  });

  it("notes 컬럼은 NOT NULL DEFAULT ''", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    expect(sql).toContain("add column notes text not null default ''");
  });
});
