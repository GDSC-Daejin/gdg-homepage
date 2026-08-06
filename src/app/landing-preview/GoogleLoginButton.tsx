"use client";

export function GoogleLoginButton({ className }: { className?: string }) {
  async function handleGoogleLogin() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
  }

  return (
    <button type="button" className={className} onClick={handleGoogleLogin}>
      Google로 로그인하기
    </button>
  );
}
