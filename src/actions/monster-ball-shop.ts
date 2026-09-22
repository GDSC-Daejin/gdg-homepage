"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

const quantities = new Set([1, 5, 10]);

export async function purchaseMonsterBalls(formData: FormData): Promise<ActionResult> {
  if (await isDemoMode()) return { error: "미리보기 모드에서는 몬스터볼을 교환할 수 없어요" };

  const quantity = Number(formData.get("quantity"));
  const requestId = String(formData.get("request_id") ?? "");
  if (!quantities.has(quantity) || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return { error: "교환 요청이 올바르지 않아요" };
  }

  const { data, error } = await (await createClient()).rpc("purchase_monster_balls", {
    p_quantity: quantity,
    p_request_id: requestId,
  });
  if (error) return { error: toKoreanError(error) };
  if (!data?.ok) {
    if (data?.reason === "insufficient") return { error: `포인트가 부족해요. 현재 ${data.balance ?? 0}P예요` };
    if (data?.reason === "daily_limit") return { error: `오늘은 몬스터볼을 ${data.remaining ?? 0}개 더 구매할 수 있어요` };
    return { error: "몬스터볼을 교환하지 못했어요" };
  }

  revalidatePath("/store");
  revalidatePath("/pokedex");
  return {};
}
