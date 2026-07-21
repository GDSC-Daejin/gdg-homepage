import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES, type Profile } from "@/lib/types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // getClaims: JWKS 로컬 검증(ECC 비대칭 키) → Auth 서버 네트워크 왕복 제거
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return (data as Profile) ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.student_no === "") redirect("/onboarding");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (!ADMIN_ROLES.includes(profile.role)) redirect("/");
  return profile;
}
