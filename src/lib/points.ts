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
