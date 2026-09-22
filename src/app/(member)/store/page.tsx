import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { ShopClient } from "./ShopClient";

export default async function StorePage() {
  const profile = await requireProfile();
  let points = 0;
  let balls = 0;
  let dailyPurchased = 0;

  if (await isDemoMode()) {
    points = 1_250;
    balls = 3;
  } else {
    const supabase = await createClient();
    const [{ data: pointRows }, { data: inventory }, { data: redemptions }] = await Promise.all([
      supabase.from("point_logs").select("amount").eq("user_id", profile.id),
      supabase.from("pokemon_ball_inventory").select("quantity").eq("user_id", profile.id).eq("ball_slug", "poke_ball").maybeSingle(),
      supabase.from("monster_ball_redemptions").select("quantity").eq("user_id", profile.id).eq("redeemed_on", new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })),
    ]);
    points = (pointRows ?? []).reduce((sum, row) => sum + row.amount, 0);
    balls = inventory?.quantity ?? 0;
    dailyPurchased = (redemptions ?? []).reduce((sum, row) => sum + row.quantity, 0);
  }

  return <div>
    <PageHeader title="프렌들리숍" description="포인트로 몬스터볼을 교환해 도감 포획을 준비해요." />
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      <Card className="p-4"><p className="text-sm text-gray-500">사용 가능 포인트</p><p className="mt-1 text-3xl font-bold text-gray-900">{points.toLocaleString()}<span className="ml-1 text-base font-medium text-gray-500">P</span></p></Card>
      <Card className="p-4"><p className="text-sm text-gray-500">몬스터볼 보유량</p><p className="mt-1 text-3xl font-bold text-primary">{balls}<span className="ml-1 text-base font-medium text-gray-500">개</span></p></Card>
    </div>
    <ShopClient dailyPurchased={dailyPurchased} />
    <p className="mt-6 text-xs leading-5 text-gray-500">하루에 최대 10개까지 교환할 수 있어요. 5개 묶음은 450P, 10개 묶음은 900P예요.</p>
  </div>;
}
