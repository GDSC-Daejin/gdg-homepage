"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDemoMode } from "@/lib/demo";
import { toKoreanError } from "@/lib/errors";
import { parseGroupForm } from "@/lib/group-form";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const ADMIN_PATH = "/admin/groups";
const uuid = z.string().uuid();

export async function createGroup(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const { data, error: validationError } = parseGroupForm(formData);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("groups").insert(data);
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}

export async function updateGroup(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const { data, error: validationError } = parseGroupForm(formData);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("groups").update(data).eq("id", id);
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}

export async function setGroupPublic(
  id: string,
  isPublic: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase
    .from("groups")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  revalidatePath("/projects");
  return {};
}

export async function removeMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) return { error: toKoreanError(error) };
  revalidatePath(ADMIN_PATH);
  return {};
}

export async function assignGroupMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};
  if (!uuid.safeParse(groupId).success || !uuid.safeParse(userId).success) {
    return { error: "요청이 올바르지 않습니다" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_group_member", {
    p_group: groupId,
    p_user: userId,
  });
  if (error) {
    const messages: Record<string, string> = {
      NOT_FOUND: "그룹을 찾을 수 없습니다",
      FULL: "정원이 가득 찼습니다",
    };
    const key = Object.keys(messages).find((code) => error.message.includes(code));
    return { error: key ? messages[key] : toKoreanError(error) };
  }

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${groupId}`);
  return {};
}

export async function joinGroup(groupId: string): Promise<ActionResult> {
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_group", { p_group: groupId });
  if (error) {
    const messages: Record<string, string> = {
      NOT_FOUND: "존재하지 않는 그룹입니다",
      NOT_RECRUITING: "지금은 모집 중이 아닙니다",
      FULL: "정원이 가득 찼습니다",
    };
    const key = Object.keys(messages).find((code) => error.message.includes(code));
    return { error: key ? messages[key] : toKoreanError(error) };
  }
  revalidatePath("/groups");
  return {};
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  if (await isDemoMode()) return {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다" };
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) return { error: toKoreanError(error) };
  revalidatePath("/groups");
  return {};
}
