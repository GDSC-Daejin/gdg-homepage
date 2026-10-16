import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { purchaseMonsterBalls } from "@/actions/monster-ball-shop";
import { MONSTER_BALL_DAILY_LIMIT, MONSTER_BALL_PRODUCTS } from "@/lib/monster-ball-shop";
import { latestFunction } from "./migration-sql";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/demo", () => ({ isDemoMode: vi.fn().mockResolvedValue(false) }));

const REQUEST_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function form(quantity: number, requestId = REQUEST_ID) {
  const formData = new FormData();
  formData.set("quantity", String(quantity));
  formData.set("request_id", requestId);
  return formData;
}

describe("웹 프렌들리숍 몬스터볼 교환", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    rpc.mockReset();
    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
  });

  it.each(MONSTER_BALL_PRODUCTS)("몬스터볼 $quantity개 상품을 RPC로 넘긴다", async ({ quantity }) => {
    rpc.mockResolvedValue({ data: { ok: true, quantity }, error: null });

    await expect(purchaseMonsterBalls(form(quantity))).resolves.toEqual({});
    expect(rpc).toHaveBeenCalledWith("purchase_monster_balls", { p_quantity: quantity, p_request_id: REQUEST_ID });
  });

  it("3개 묶음을 80P로 교환할 수 있다", async () => {
    rpc.mockResolvedValue({ data: { ok: true, quantity: 3, spent: 70, balance: 10, balls: 3 }, error: null });

    await expect(purchaseMonsterBalls(form(3))).resolves.toEqual({});
  });

  it("상품에 없는 수량은 RPC를 부르지 않는다", async () => {
    await expect(purchaseMonsterBalls(form(10))).resolves.toEqual({ error: "교환 요청이 올바르지 않아요" });
    await expect(purchaseMonsterBalls(form(3, "not-a-uuid"))).resolves.toEqual({ error: "교환 요청이 올바르지 않아요" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("포인트 부족과 하루 한도 초과를 이유와 함께 알려 준다", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: "insufficient", balance: 55 }, error: null });
    await expect(purchaseMonsterBalls(form(3))).resolves.toEqual({ error: "포인트가 부족해요. 현재 55P예요" });

    rpc.mockResolvedValueOnce({ data: { ok: false, reason: "daily_limit", remaining: 2 }, error: null });
    await expect(purchaseMonsterBalls(form(3))).resolves.toEqual({ error: "오늘은 몬스터볼을 2개 더 구매할 수 있어요" });

    rpc.mockResolvedValueOnce({ data: { ok: false, reason: "not_member" }, error: null });
    await expect(purchaseMonsterBalls(form(1))).resolves.toEqual({ error: "회원만 이용할 수 있어요" });
  });

  it("같은 요청이 다시 와도 RPC가 돌려준 재실행 결과를 성공으로 처리한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true, replayed: true, quantity: 3 }, error: null });

    await expect(purchaseMonsterBalls(form(3))).resolves.toEqual({});
    await expect(purchaseMonsterBalls(form(3))).resolves.toEqual({});
    expect(rpc.mock.calls.every(([, args]) => args.p_request_id === REQUEST_ID)).toBe(true);
  });
});

describe("purchase_monster_balls RPC", () => {
  it("화면·서버 액션과 같은 수량·가격·하루 한도를 쓴다", async () => {
    const fn = await latestFunction("purchase_monster_balls");
    const quantities = MONSTER_BALL_PRODUCTS.map((product) => product.quantity).join(", ");
    const prices = MONSTER_BALL_PRODUCTS.map((product) => `when ${product.quantity} then ${product.price}`).join(" ");

    expect(fn).toContain(`p_quantity not in (${quantities})`);
    expect(fn).toContain(`v_price := case p_quantity ${prices} end`);
    expect(fn).toContain(`v_daily_quantity + p_quantity > ${MONSTER_BALL_DAILY_LIMIT}`);
  });

  it("검사를 모두 마친 뒤에만 쓰기를 해서 실패하면 포인트·볼·기록이 바뀌지 않는다", async () => {
    const fn = await latestFunction("purchase_monster_balls");
    const lock = fn.indexOf("pg_advisory_xact_lock");
    const firstWrite = fn.indexOf("insert into");
    const lastFailure = fn.lastIndexOf("'ok', false");

    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(fn.indexOf("from monster_ball_redemptions"));
    expect(lastFailure).toBeLessThan(firstWrite);
    for (const table of ["monster_ball_redemptions", "point_logs", "pokemon_ball_inventory"]) {
      expect(fn.indexOf(`insert into ${table}`)).toBeGreaterThan(lastFailure);
    }
    expect(fn).not.toMatch(/exception\s+when/i);
  });

  it("같은 request_id는 다시 차감하지 않고 기록된 결과를 돌려준다", async () => {
    const fn = await latestFunction("purchase_monster_balls");

    expect(fn.indexOf("where request_id = p_request_id")).toBeLessThan(fn.indexOf("insert into"));
    expect(fn).toContain("'replayed', true");
  });
});
