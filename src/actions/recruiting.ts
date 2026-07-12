"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recruitingSettingsSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type { ActionResult } from "@/lib/types";

export async function updateRecruitingSettings(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const parsed = recruitingSettingsSchema.safeParse({
    season: formData.get("season"),
    is_open: formData.get("is_open") === "on",
    open_positions: formData.getAll("open_positions").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_recruiting_settings", {
    p_season: parsed.data.season,
    p_is_open: parsed.data.is_open,
    p_open_positions: parsed.data.open_positions,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/apply");
  revalidatePath("/");
  return {};
}
