"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult, Role, MemberStatus } from "@/lib/types";

export async function setMemberRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    p_user: userId,
    p_role: role,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
  return {};
}

export async function setMemberStatus(
  userId: string,
  status: MemberStatus,
): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_status", {
    p_user: userId,
    p_status: status,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
  return {};
}
