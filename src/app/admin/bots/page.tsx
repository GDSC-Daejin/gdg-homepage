import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { PageHeader } from "@/components/PageHeader";
import { BotToggleList } from "./BotToggleList";
import type { Bot } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEMO_BOTS: Bot[] = [{ slug: "squirtle", name: "꼬북봇", active: true }];

export default async function AdminBotsPage() {
  let bots: Bot[] = DEMO_BOTS;

  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bots")
      .select("slug, name, active")
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
    </div>
  );
}
