"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isOwnAvatarPath } from "@/lib/avatar";
import { getProfile } from "@/lib/auth";
import { profileSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) redirect("/");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    nickname: formData.get("nickname"),
    student_no: formData.get("student_no"),
    major: formData.get("major"),
    phone: formData.get("phone"),
    interests: formData.getAll("interests"),
    position: formData.get("position"),
    academic_status: formData.get("academic_status") || null,
    featured_pokemon_id: formData.get("featured_pokemon_id") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }
  if (profile.student_no === "" && (!parsed.data.academic_status || !parsed.data.interests.length)) {
    return { error: "모든 필수 항목을 입력해주세요" };
  }

  const supabase = await createClient();
  const { featured_pokemon_id, ...profileData } = parsed.data;
  const { error: featuredError } = await supabase.rpc("set_featured_pokemon", {
    p_pokemon: featured_pokemon_id ?? null,
  });
  if (featuredError) return { error: toKoreanError(featuredError) };
  const { error } = await supabase
    .from("profiles")
    .update(profileData)
    .eq("id", profile.id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/", "layout");

  if (profile.student_no === "") redirect("/");
  return {};
}

export async function setProfileAvatar(path: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (!isOwnAvatarPath(profile.id, path)) {
    return { error: "프로필 사진 경로가 올바르지 않아요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", profile.id);

  if (error) return { error: toKoreanError(error) };
  revalidatePath("/", "layout");
  return {};
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
