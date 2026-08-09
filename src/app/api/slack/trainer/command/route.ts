import { createClient } from "@supabase/supabase-js";
import { gameAmountBlocks, shopBlocks } from "@/lib/trainer-market/blocks";
import { trainerHelp, trendMessage } from "@/lib/trainer-market/messages";
import { verifySlackSignature } from "@/lib/slack/verify";

function reply(text: string, blocks?: Record<string, unknown>[]) {
  return Response.json({ response_type: "ephemeral", text, blocks });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingSecret = process.env.TRAINER_SLACK_SIGNING_SECRET ?? process.env.POKEDEX_SLACK_SIGNING_SECRET;
  if (!signingSecret || !verifySlackSignature({ rawBody, timestamp: request.headers.get("x-slack-request-timestamp"), signature: request.headers.get("x-slack-signature"), signingSecret })) return Response.json({ error: "invalid_signature" }, { status: 401 });
  const form = new URLSearchParams(rawBody);
  const slackUserId = form.get("user_id");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!slackUserId || !url || !key) return Response.json({ error: "not_configured" }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: bot } = await supabase.from("bots").select("active").eq("slug", "trainer_market").maybeSingle();
  if (!bot?.active) return reply("트레이너 마켓봇은 지금 쉬는 중이에요.");
  const [command, arg] = (form.get("text") ?? "").trim().toLowerCase().split(/\s+/, 2);

  if (!command || command === "도움말" || command === "help") return reply(trainerHelp());
  if (command === "시작") {
    const { data } = await supabase.rpc("trainer_start", { p_slack_user: slackUserId });
    const result = data as { ok?: boolean; started?: boolean; balance?: number } | null;
    if (!result?.ok) return reply("연결된 활성 회원 계정을 찾지 못했어요. 회원 승인과 Slack 계정 연결을 확인해 주세요.");
    return reply(result.started ? `🎒 트레이너 카드가 발급됐어요! 시작 500TP를 받았어요. 현재 ${result.balance}TP` : `이미 트레이너 카드가 있어요. 현재 ${result.balance}TP`);
  }
  if (command === "출석") {
    const { data } = await supabase.rpc("trainer_checkin", { p_slack_user: slackUserId });
    const result = data as { ok?: boolean; claimed?: boolean; balance?: number } | null;
    if (!result?.ok) return reply("먼저 `/trainer 시작`으로 트레이너 카드를 발급해 주세요.");
    return reply(result.claimed ? `📟 포켓기어가 오늘의 탐험을 기록했어요. +50TP · 현재 ${result.balance}TP` : `오늘 출석은 이미 기록됐어요. 현재 ${result.balance}TP`);
  }
  if (command === "게임코너") return reply("🎲 게임코너 · 피카츄 주사위의 홀짝을 맞혀 보세요. 하루 3회, 총 100TP까지예요.", gameAmountBlocks());
  if (command === "상점") return reply("🏪 프렌들리숍 · 몬스터볼 1개는 200TP예요.", shopBlocks());
  if (command === "내" || command === "내tp" || command === "카드") {
    const { data } = await supabase.rpc("trainer_card", { p_slack_user: slackUserId });
    const result = data as { ok?: boolean; balance?: number; checked_in?: boolean; bets?: number; bet_stake?: number } | null;
    if (!result?.ok) return reply("먼저 `/trainer 시작`으로 트레이너 카드를 발급해 주세요.");
    return reply(`🎒 트레이너 카드\nTP ${result.balance}\n오늘 출석 ${result.checked_in ? "완료" : "미완료"} · 게임코너 ${result.bets}/3회 · 베팅 ${result.bet_stake}/100TP`);
  }
  if (command === "시세" || command === "추이") {
    const { data } = await supabase.rpc("trainer_stock_trend", { p_symbol: (arg ?? "SILPH").toUpperCase() });
    const result = data as { symbol: string; name: string | null; prices: Array<{ close: number; open: number }> } | null;
    return reply(result ? trendMessage(result.symbol, result.name, result.prices) : "시세를 불러오지 못했어요.");
  }
  return reply(trainerHelp());
}
