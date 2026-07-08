"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function LoginPage() {
  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-gray-900">GDG DJU</h1>
        <p className="mt-1 text-sm text-gray-500">
          구글 계정으로 로그인해주세요
        </p>
        <Button
          variant="primary"
          className="mt-6 w-full"
          onClick={handleGoogleLogin}
        >
          구글로 로그인
        </Button>
      </Card>
    </div>
  );
}
