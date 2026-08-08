import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs, SYSTEM_TABS } from "../SectionTabs";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { displayName } from "@/lib/format";
import { summarizeContributions } from "@/lib/squirtle/backfill";
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

const DEMO_CONTRIBUTORS = [
  { id: "demo-contributor-1", name: "예시 회원 A", count: 8 },
  { id: "demo-contributor-2", name: "예시 회원 B", count: 6 },
];

export default async function AdminBotsPage() {
  let bots: Bot[] = DEMO_BOTS;
  let contributors = DEMO_CONTRIBUTORS;

  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bots")
      .select("slug, name, description, active")
      .order("slug", { ascending: true });
    bots = (data ?? []) as Bot[];

    const { data: season } = await supabase
      .from("squirtle_seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle();
    if (season) {
      const { data: checkins } = await supabase
        .from("squirtle_checkins")
        .select("user_id, created_at")
        .eq("season_id", season.id);
      const totals = summarizeContributions((checkins ?? []) as { user_id: string; created_at: string }[]);
      const ids = totals.map((contributor) => contributor.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, name, nickname").in("id", ids).not("approved_at", "is", null)
        : { data: [] as { id: string; name: string; nickname: string }[] };
      const names = new Map(
        ((profiles ?? []) as { id: string; name: string; nickname: string }[]).map((profile) => [
          profile.id,
          displayName(profile.name, profile.nickname),
        ]),
      );
      contributors = totals.flatMap((contributor) => {
        const name = names.get(contributor.user_id);
        return name ? [{ id: contributor.user_id, name, count: contributor.count }] : [];
      });
    }
  }

  return (
    <div>
      <SectionTabs tabs={SYSTEM_TABS} label="시스템" />
      <PageHeader
        title="봇"
        description="슬랙봇을 하나씩 켜고 꺼요. 끄면 알림을 올리지 않아요"
      />
      <BotToggleList bots={bots} />
      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-lg font-bold text-gray-900">이번 시즌 기여</h2>
          <p className="mt-1 text-sm text-gray-500">물 마시기 인증 횟수예요.</p>
        </div>
        {contributors.length === 0 ? (
          <EmptyState title="아직 기여 기록이 없어요" description="첫 인증이 들어오면 회원별 횟수를 보여줘요." />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">회원</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">인증 횟수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contributors.map((contributor) => (
                  <tr key={contributor.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{contributor.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-gray-700">{contributor.count}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
      <p className="mt-4 text-xs text-gray-500">
        리액션으로 포인트를 받으려면 회원과 슬랙 계정이 연결되어 있어야 해요.{" "}
        <Link href="/admin/bots/links" className="font-medium text-primary underline">
          슬랙 계정 연결 →
        </Link>
      </p>
    </div>
  );
}
