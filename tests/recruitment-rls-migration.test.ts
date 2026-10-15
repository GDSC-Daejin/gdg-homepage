import { readdir, readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { latestFunction } from "./migration-sql";

type Policy = { file: string; name: string; table: string; command: string; using: string; check: string };

let policies: Policy[] = [];
let allSql = "";

beforeAll(async () => {
  const dir = "supabase/migrations";
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  const sources = await Promise.all(files.map(async (file) => ({ file, sql: await readFile(`${dir}/${file}`, "utf8") })));
  allSql = sources.map((source) => source.sql).join("\n");
  const pattern = /create policy "([^"]+)"\s+on public\.(\w+)\s+for (\w+)(?:\s+to [\w, ]+)?\s*(?:using \(([\s\S]*?)\))?\s*(?:with check \(([\s\S]*?)\))?;/g;
  policies = sources.flatMap(({ file, sql }) =>
    [...sql.matchAll(pattern)].map((match) => ({
      file,
      name: match[1],
      table: match[2],
      command: match[3],
      using: match[4] ?? "",
      check: match[5] ?? "",
    })),
  );
});

function policiesOn(table: string) {
  return policies.filter((policy) => policy.table === table);
}

describe("모집 마이그레이션 RLS·권한", () => {
  it.each(["application_email_logs", "application_email_events"])("%s: RLS를 켜고 운영진 읽기만 허용한다", (table) => {
    expect(allSql).toContain(`alter table public.${table} enable row level security`);
    const tablePolicies = policiesOn(table);
    expect(tablePolicies.length).toBeGreaterThan(0);
    // 쓰기 정책이 없으므로 anon·authenticated는 쓸 수 없다. 쓰기는 service role(웹훅·발송 기록)만 한다.
    for (const policy of tablePolicies) {
      expect(policy.command).toBe("select");
      expect(policy.using).toContain("public.is_admin()");
    }
  });

  it("지원 질문은 누구나 읽고(비로그인 /apply) 운영진만 쓴다", () => {
    expect(allSql).toContain("alter table public.application_questions enable row level security");
    const tablePolicies = policiesOn("application_questions");
    const writes = tablePolicies.filter((policy) => policy.command !== "select");
    expect(tablePolicies.find((policy) => policy.command === "select")?.using).toBe("true");
    expect(writes.length).toBeGreaterThan(0);
    for (const policy of writes) {
      expect(policy.using).toContain("public.is_admin()");
      expect(policy.check).toContain("public.is_admin()");
    }
  });

  it("질문 프리셋은 읽기까지 운영진 전용이다", () => {
    expect(allSql).toContain("alter table public.application_question_presets enable row level security");
    for (const policy of policiesOn("application_question_presets")) {
      expect(policy.using).toContain("public.is_admin()");
      expect(policy.check).toContain("public.is_admin()");
    }
  });

  it("프리셋 적용 RPC는 운영진 확인 후에만 질문을 바꾸고 anon 실행을 막는다", async () => {
    const fn = await latestFunction("admin_apply_application_question_preset");
    expect(fn).toContain("security definer set search_path = public");
    expect(fn.indexOf("if not public.is_admin() then raise exception 'FORBIDDEN'")).toBeLessThan(fn.indexOf("delete from public.application_questions"));
    expect(allSql).toContain("revoke execute on function public.admin_apply_application_question_preset(uuid) from public, anon;");
  });

  it("모집 설정 RPC는 운영진만, 모집 중에는 포지션을 잠근다", async () => {
    const fn = await latestFunction("admin_update_recruiting_settings");
    expect(fn).toContain("if not public.is_admin() then raise exception 'FORBIDDEN'");
    expect(fn).toContain("OPEN_POSITIONS_LOCKED");
    expect(allSql).toContain("revoke execute on function public.admin_update_recruiting_settings(text, boolean, text[], date, date) from public, anon;");
  });
});
