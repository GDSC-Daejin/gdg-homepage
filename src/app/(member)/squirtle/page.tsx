import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { isDemoMode } from "@/lib/demo";
import { displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Contributor = { name: string; nickname: string | null; count: number };
type Season = { id: string; starts_on: string; stage: number; total_count: number; contributors: Contributor[] };

const STAGE_NAMES = ["꼬부기", "어니부기", "거북왕"];
const DEMO_SEASONS: Season[] = [
  { id: "demo-squirtle-season", starts_on: "2026-07-01", stage: 3, total_count: 218, contributors: [{ name: "예시 회원 A", nickname: null, count: 18 }, { name: "예시 회원 B", nickname: null, count: 15 }, { name: "예시 회원 C", nickname: null, count: 12 }] },
];

function seasonDate(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(`${date}T00:00:00+09:00`));
}

export default async function SquirtleHistoryPage() {
  let seasons = DEMO_SEASONS;

  if (!(await isDemoMode())) {
    const { data } = await (await createClient()).rpc("squirtle_season_history");
    seasons = (data ?? []) as Season[];
  }

  return (
    <div>
      <PageHeader title="꼬북봇 지난 시즌" description="물 마시기 인증으로 함께 키운 꼬북이의 기록이에요." />
      {seasons.length === 0 ? (
        <EmptyState title="지난 시즌이 아직 없어요" description="꼬북이가 거북왕으로 진화하면 이곳에 기록이 남아요." />
      ) : (
        <div className="space-y-4">
          {seasons.map((season) => (
            <Card key={season.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500">{seasonDate(season.starts_on)} 시작</p>
                  <h2 className="mt-1 text-lg font-bold text-gray-900">최종 진화 · {STAGE_NAMES[season.stage - 1] ?? "꼬부기"}</h2>
                </div>
                <p className="text-sm font-semibold text-primary">총 {season.total_count.toLocaleString("ko-KR")}잔</p>
              </div>
              <div className="mt-5 border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">기여 순위</h3>
                {season.contributors.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">인증 기록이 없어요.</p>
                ) : (
                  <ol className="mt-2 space-y-2">
                    {season.contributors.map((contributor, index) => (
                      <li key={`${contributor.name}-${index}`} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{index + 1}. {displayName(contributor.name, contributor.nickname)}</span>
                        <span className="font-medium tabular-nums text-gray-900">{contributor.count}회</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
