import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0058_pokedex_throw_notices.sql", "utf8").catch(() => "");
});

describe("도감봇 포획 불가 안내", () => {
  it("같은 회원의 같은 출현·사유 안내를 한 번만 저장한다", () => {
    expect(sql).toContain("create table public.pokemon_throw_notices");
    expect(sql).toContain("primary key (appearance_id, slack_user_id, reason)");
  });
});
