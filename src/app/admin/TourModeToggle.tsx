"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDemoMode } from "@/actions/demo";

export function TourModeToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await setDemoMode(!active);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      <span>둘러보기 모드</span>
      <span
        className={`ml-2 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          active ? "bg-white/30" : "bg-gray-300"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-3" : ""
          }`}
        />
      </span>
    </button>
  );
}
