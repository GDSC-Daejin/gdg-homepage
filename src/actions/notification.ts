"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

export async function markNotificationsRead(ids: string[]): Promise<ActionResult> {
  const profile = await requireProfile();
  if (await isDemoMode() || ids.length === 0) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/", "layout");
  return {};
}

export async function markAllRead(): Promise<ActionResult> {
  const profile = await requireProfile();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profile.id)
    .is("read_at", null);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/", "layout");
  return {};
}
