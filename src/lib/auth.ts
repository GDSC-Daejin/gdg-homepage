import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasAuthCookie } from "@/lib/supabase/has-auth-cookie";
import { isStaff, type Profile } from "@/lib/types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const cookieStore = await cookies();
  if (!hasAuthCookie(cookieStore.getAll())) return null;

  const supabase = await createClient();
  const requestHeaders = await headers();
  let userId = requestHeaders.get("x-gdg-user-id");
  if (!userId) {
    // proxy를 거치지 않는 실행 문맥의 안전한 폴백
    const { data: claimsData } = await supabase.auth.getClaims();
    userId = claimsData?.claims.sub ?? null;
  }
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return (data as Profile) ?? null;
});

export function assertApproved(profile: Profile): void {
  // 승인 전 화면은 온보딩 하나로 합쳤다 — 제출 전이면 폼, 제출 후면 대기 안내를 같은 곳에서 본다.
  if (!profile.approved_at && !isStaff(profile)) redirect("/onboarding");
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.student_no === "") redirect("/onboarding");
  assertApproved(profile);
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isStaff(profile)) redirect("/");
  return profile;
}
