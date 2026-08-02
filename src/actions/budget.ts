"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { budgetSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

export async function createBudgetEntry(
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = budgetSchema.safeParse({
    entry_date: formData.get("entry_date"),
    type: formData.get("type"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    memo: formData.get("memo") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_entries")
    .insert({ ...parsed.data, created_by: profile.id });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/budget");
  return {};
}

export async function deleteBudgetEntry(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("budget_entries")
    .delete()
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/budget");
  return {};
}
