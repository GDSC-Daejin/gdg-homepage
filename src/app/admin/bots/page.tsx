import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { PageHeader } from "@/components/PageHeader";
import { BotToggleList } from "./BotToggleList";
import type { Bot } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEMO_BOTS: Bot[] = [
  {
    slug: "squirtle",
    name: "꼬북봇",
    description:
      "매일 오전 10시 #아무말대잔치에 물 마시기 알림을 올려요. 이모지 리액션으로 하루 한 번 인증하면 포인트가 쌓이고, 모인 인증으로 꼬북이가 꼬부기 → 어니부기 → 거북왕으로 진화해요.",
    active: true,
  },
];

export default async function AdminBotsPage() {
  let bots: Bot[] = DEMO_BOTS;

  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bots")
      .select("slug, name, description, active")
      .order("slug", { ascending: true });
    bots = (data ?? []) as Bot[];
  }

  return (
    <div>
      <PageHeader
        title="봇"
        description="슬랙봇을 하나씩 켜고 꺼요. 끄면 알림을 올리지 않아요"
      />
      <BotToggleList bots={bots} />
      <p className="mt-4 text-xs text-gray-500">
        리액션으로 포인트를 받으려면 회원과 슬랙 계정이 연결되어 있어야 해요.{" "}
        <Link href="/admin/bots/links" className="font-medium text-primary underline">
          슬랙 계정 연결 →
        </Link>
      </p>
    </div>
  );
}
