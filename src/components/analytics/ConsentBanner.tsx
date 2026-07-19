"use client";

import { Button } from "@/components/Button";

interface ConsentBannerProps {
  onDecision: (value: "granted" | "denied") => void;
}

export function ConsentBanner({ onDecision }: ConsentBannerProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:bg-gray-50/95">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-700">
          서비스 개선을 위해 방문·행동 데이터를 수집합니다. 동의하시겠어요?
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" onClick={() => onDecision("denied")}>
            거부
          </Button>
          <Button variant="primary" onClick={() => onDecision("granted")}>
            동의
          </Button>
        </div>
      </div>
    </div>
  );
}
