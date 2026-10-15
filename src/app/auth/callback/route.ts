import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (next) {
        return NextResponse.redirect(loginCompleteUrl(origin, next));
      }

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

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/admin" || value === "/onboarding") return value;
  if (value.startsWith("/onboarding/invite?token=")) return value;
  return null;
}

function loginCompleteUrl(origin: string, next: string): URL {
  const url = new URL("/auth/complete", origin);
  url.searchParams.set("next", next);
  return url;
}
