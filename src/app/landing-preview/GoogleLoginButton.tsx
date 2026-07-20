"use client";

import { createClient } from "@/lib/supabase/client";

export function GoogleLoginButton({ className }: { className?: string }) {
  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button type="button" className={className} onClick={handleGoogleLogin}>
      Google로 로그인하기
    </button>
  );
}
