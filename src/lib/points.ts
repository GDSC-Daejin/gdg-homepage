import { monthKst } from "@/lib/format";
import type { PointLog } from "@/lib/types";

export function sumPointsInMonth(
  logs: Pick<PointLog, "amount" | "created_at">[],
  month: string,
): number {
  return logs
    .filter((log) => monthKst(log.created_at) === month)
    .reduce((sum, log) => sum + log.amount, 0);
}

/** 해당 월(KST) 로그를 획득(양수 합)과 사용(음수 합의 절댓값)으로 나눈다. */
export function splitPointsInMonth(
  logs: Pick<PointLog, "amount" | "created_at">[],
  month: string,
): { earned: number; spent: number } {
  let earned = 0;
  let spent = 0;
  for (const log of logs) {
    if (monthKst(log.created_at) !== month) continue;
    if (log.amount > 0) earned += log.amount;
    else spent -= log.amount;
  }
  return { earned, spent };
}
