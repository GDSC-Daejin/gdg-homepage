"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkApplicationAccount } from "@/actions/application";
import { Button } from "@/components/Button";

export function LinkAccountButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={pending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            const result = await linkApplicationAccount(token);
            if (result.error) setError(result.error);
            else router.replace("/onboarding");
          });
        }}
      >
        {pending ? "지원서 연결 중..." : "이 계정으로 가입 계속하기"}
      </Button>
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
