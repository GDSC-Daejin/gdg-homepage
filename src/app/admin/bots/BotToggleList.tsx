"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBotActive } from "@/actions/bot";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import type { Bot } from "@/lib/types";

export function BotToggleList({ bots }: { bots: Bot[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function toggle(bot: Bot) {
    setError(undefined);
    startTransition(async () => {
      const result = await setBotActive(bot.slug, !bot.active);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (bots.length === 0) {
    return (
      <EmptyState
        title="등록된 봇이 없어요"
        description="봇을 추가하면 여기에서 켜고 끌 수 있어요."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {bots.map((bot) => (
          <Card key={bot.slug} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-gray-900">{bot.name}</p>
                {!bot.active && (
                  <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-xs font-medium">
                    쉬는 중
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500">
                {bot.active
                  ? "매일 정해진 시각에 알림을 올려요"
                  : "알림을 올리지 않아요. 이미 올라간 글의 리액션은 그대로 인정돼요"}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={bot.active}
              aria-label={`${bot.name} ${bot.active ? "끄기" : "켜기"}`}
              disabled={pending}
              onClick={() => toggle(bot)}
              className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${
                bot.active ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  bot.active ? "translate-x-5" : ""
                }`}
              />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
