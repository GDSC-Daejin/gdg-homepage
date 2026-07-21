import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
          .select("student_no")
          .eq("id", user.id)
          .single();

        if (profile && profile.student_no !== "") {
          return NextResponse.redirect(loginCompleteUrl(origin, "/"));
        }
      }

      return NextResponse.redirect(loginCompleteUrl(origin, "/onboarding"));
    }
  }

  return NextResponse.redirect(`${origin}/`);
}

function loginCompleteUrl(origin: string, next: string): URL {
  const url = new URL("/auth/complete", origin);
  url.searchParams.set("next", next);
  return url;
}
