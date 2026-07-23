"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

export async function setBotActive(slug: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("bots")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/bots");
  return {};
}
