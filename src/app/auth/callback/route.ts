import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES, type Role } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("student_no, role")
          .eq("id", user.id)
          .single();

        if (profile && profile.student_no !== "") {
          return NextResponse.redirect(
            ADMIN_ROLES.includes(profile.role as Role)
              ? `${origin}/admin`
              : `${origin}/`,
          );
        }
      }

      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
