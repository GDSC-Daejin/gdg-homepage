import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/0112_trainer_market_pick_guardrails.sql", "utf8");

it("응원권 선택은 유효한 입력, 한도, 잔액, 장중 여부를 DB에서 막는다", () => {
  for (const rule of ["p_quantity is null", "p_quantity not between 1 and 3", "v_market.status <> 'open'", "reason', 'duplicate'", ">= 3 then return jsonb_build_object('ok', false, 'reason', 'company_limit')", "+ p_quantity > 5", "v_balance < v_stake"]) {
    expect(migration).toContain(rule);
  }
});

it("같은 클릭만 재시도할 수 있고, 장마감과 같은 잠금 순서를 쓴다", () => {
  expect(migration).toContain("v_pick.user_id <> v_user or v_pick.symbol <> p_symbol or v_pick.quantity <> p_quantity");
  expect(migration.indexOf("where market_date = v_today for update")).toBeLessThan(migration.indexOf("pg_advisory_xact_lock"));
});
