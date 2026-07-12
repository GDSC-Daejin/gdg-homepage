"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { profileSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    student_no: formData.get("student_no"),
    major: formData.get("major"),
    phone: formData.get("phone"),
    interests: formData.getAll("interests"),
    position: formData.get("position"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", profile.id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath("/", "layout");

  if (profile.student_no === "") redirect("/");
  return {};
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
