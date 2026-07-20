"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toKoreanError } from "@/lib/errors";
import { isDemoMode } from "@/lib/demo";
import type {
  ActionResult,
  Role,
  Position,
  MemberStatus,
  AcademicStatus,
  Profile,
} from "@/lib/types";

export async function setMemberRole(
  userId: string,
  role: Role,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

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

export async function setMemberPosition(
  userId: string,
  position: Position,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_position", {
    p_user: userId,
    p_position: position,
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
  if (await isDemoMode()) return {};

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

export async function setMemberAcademicStatus(
  userId: string,
  academicStatus: AcademicStatus | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_academic_status", {
    p_user: userId,
    p_academic_status: academicStatus,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
  return {};
}

export async function updateMemberProfile(
  userId: string,
  profile: Pick<Profile, "name" | "nickname" | "student_no" | "major" | "phone" | "interests">,
): Promise<ActionResult> {
  await requireAdmin();
  if (await isDemoMode()) return {};

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_profile", {
    p_user: userId,
    p_name: profile.name,
    p_nickname: profile.nickname,
    p_student_no: profile.student_no,
    p_major: profile.major,
    p_phone: profile.phone,
    p_interests: profile.interests,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${userId}`);
  return {};
}
