import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { formatKstDate } from "@/lib/format";
import type { BudgetEntry } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { DEMO_BUDGET_ENTRIES } from "@/lib/demoData";
import { BudgetEntryForm } from "./BudgetEntryForm";
import { DeleteBudgetEntryButton } from "./DeleteBudgetEntryButton";

export const dynamic = "force-dynamic";

function toWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export default async function AdminBudgetPage() {
  await requireAdmin();
  const demo = await isDemoMode();

  let entries: BudgetEntry[] = DEMO_BUDGET_ENTRIES;

  if (!demo) {
    const supabase = await createClient();
    const { data: entriesData } = await supabase
      .from("budget_entries")
      .select("*")
      .order("entry_date", { ascending: false });

    entries = (entriesData as BudgetEntry[]) ?? [];
  }

  const totalIncome = entries
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div>
      <PageHeader
        title="예산/후원 관리"
        description="수입·지출 내역을 관리해요"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="총 수입" value={toWon(totalIncome)} />
        <StatCard label="총 지출" value={toWon(totalExpense)} />
        <StatCard label="잔액" value={toWon(balance)} />
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">
          내역 추가
        </h2>
        <BudgetEntryForm />
      </Card>

      <div className="mt-6">
        {entries.length === 0 ? (
          <EmptyState title="등록된 내역이 없어요" />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">날짜</th>
                  <th className="px-4 py-3 font-medium">구분</th>
                  <th className="px-4 py-3 font-medium">분류</th>
                  <th className="px-4 py-3 font-medium">금액</th>
                  <th className="px-4 py-3 font-medium">메모</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-700">
                      {formatKstDate(entry.entry_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {entry.type === "income" ? "수입" : "지출"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {entry.category}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        entry.type === "expense"
                          ? "text-danger"
                          : "text-gray-900"
                      }`}
                    >
                      {toWon(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {entry.memo || "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteBudgetEntryButton id={entry.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
