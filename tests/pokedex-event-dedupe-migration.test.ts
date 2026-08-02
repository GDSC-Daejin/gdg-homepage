import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

let sql = "";

beforeAll(async () => {
  sql = await readFile("supabase/migrations/0062_pokedex_event_dedupe.sql", "utf8").catch(() => "");
});

describe("도감봇 Slack 이벤트 중복 방지", () => {
  it("Slack 이벤트 ID를 한 번만 저장한다", () => {
    expect(sql).toContain("create table public.pokedex_slack_events");
    expect(sql).toContain("event_id text primary key");
    expect(sql).toContain("alter table public.pokedex_slack_events enable row level security");
  });
});
