import { createClient } from "@supabase/supabase-js";
import { gameGuessBlocks, shareGameBlock, shopBlocks, stockQuantityBlocks } from "@/lib/trainer-market/blocks";
import { gameResultMessage } from "@/lib/trainer-market/messages";
import { postMessage } from "@/lib/slack/api";
import { verifySlackSignature } from "@/lib/slack/verify";

type ActionPayload = { user?: { id?: string }; channel?: { id?: string }; actions?: Array<{ action_id?: string; value?: string; action_ts?: string }> };

function reply(text: string, blocks?: Record<string, unknown>[]) {
  return Response.json({ response_type: "ephemeral", text, blocks });
}

function actionError(reason?: string) {
  const texts: Record<string, string> = { unlinked: "회원 승인과 Slack 계정 연결이 필요해요.", not_started: "먼저 `/trainer 시작`으로 트레이너 카드를 발급해 주세요.", insufficient: "TP가 부족해요.", daily_count: "게임코너는 오늘 3회까지예요.", daily_stake: "오늘 게임코너 베팅 한도 100TP를 모두 사용했어요.", closed: "관동 증권거래소는 09:00~22:00에만 열려요.", duplicate: "같은 기업은 오늘 한 번만 고를 수 있어요.", company_limit: "오늘은 서로 다른 기업을 세 곳까지 고를 수 있어요.", ticket_limit: "오늘 응원권은 총 5장까지예요." };
  return texts[reason ?? ""] ?? "요청을 처리하지 못했어요. 다시 시도해 주세요.";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingSecret = process.env.TRAINER_SLACK_SIGNING_SECRET ?? process.env.POKEDEX_SLACK_SIGNING_SECRET;
  if (!signingSecret || !verifySlackSignature({ rawBody, timestamp: request.headers.get("x-slack-request-timestamp"), signature: request.headers.get("x-slack-signature"), signingSecret })) return Response.json({ error: "invalid_signature" }, { status: 401 });
  let payload: ActionPayload;
  try { payload = JSON.parse(new URLSearchParams(rawBody).get("payload") ?? ""); } catch { return Response.json({ error: "invalid_payload" }, { status: 400 }); }
  const action = payload.actions?.[0];
  const slackUserId = payload.user?.id;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!action?.action_id || !action.value || !action.action_ts || !slackUserId || !url || !key) return Response.json({ error: "not_configured" }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: bot } = await supabase.from("bots").select("active").eq("slug", "trainer_market").maybeSingle();
  if (!bot?.active) return reply("트레이너 마켓봇은 지금 쉬는 중이에요.");

  if (action.action_id === "trainer_game_amount") return reply(`${action.value}TP를 걸어요. 홀 또는 짝을 골라 주세요.`, gameGuessBlocks(Number(action.value)));
  if (action.action_id === "trainer_game_guess") {
    const [stake, guess] = action.value.split(":");
    const { data } = await supabase.rpc("trainer_game_bet", { p_slack_user: slackUserId, p_stake: Number(stake), p_guess: guess, p_interaction_id: action.action_ts });
    const result = data as { ok?: boolean; reason?: string; id?: string; roll?: number; guess?: string; stake?: number; payout?: number; balance?: number } | null;
    if (!result?.ok) return reply(actionError(result?.reason));
    return reply(gameResultMessage({ roll: result.roll!, guess: result.guess!, stake: result.stake!, payout: result.payout!, balance: result.balance! }), shareGameBlock(result.id!));
  }
  if (action.action_id === "trainer_shop") {
    const { data } = await supabase.rpc("trainer_buy_balls", { p_slack_user: slackUserId, p_quantity: Number(action.value), p_interaction_id: action.action_ts });
    const result = data as { ok?: boolean; reason?: string; quantity?: number; balls?: number; balance?: number } | null;
    if (!result?.ok) return reply(actionError(result?.reason), result?.reason === "insufficient" ? shopBlocks() : undefined);
    return reply(`🏪 교환 완료! 몬스터볼 ${result.quantity}개를 받았어요. -${result.quantity! * 200}TP · 현재 ${result.balls}개 보유 · TP ${result.balance}`);
  }
  if (action.action_id === "trainer_stock_symbol") {
    const { data: quote } = await supabase.from("trainer_market_prices").select("open_price, trainer_market_symbols!inner(name_ko)").eq("market_date", new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })).eq("symbol", action.value).maybeSingle();
    const name = (quote?.trainer_market_symbols as { name_ko?: string } | null)?.name_ko ?? action.value;
    return reply(`📈 ${name} · 응원권은 장당 100TP예요. 장마감 22:00에 자동 정산됩니다.`, stockQuantityBlocks(action.value));
  }
  if (action.action_id === "trainer_stock") {
    const [symbol, quantity] = action.value.split(":");
    const { data } = await supabase.rpc("trainer_pick_stock", { p_slack_user: slackUserId, p_symbol: symbol, p_quantity: Number(quantity), p_interaction_id: action.action_ts });
    const result = data as { ok?: boolean; reason?: string; name?: string; quantity?: number; balance?: number } | null;
    if (!result?.ok) return reply(actionError(result?.reason));
    return reply(`📈 ${result.name} 응원권 ${result.quantity}장을 골랐어요. -${result.quantity! * 100}TP · 오늘 22:00에 자동 정산 · 현재 ${result.balance}TP`);
  }
  if (action.action_id === "trainer_game_share") {
    const { data } = await supabase.rpc("trainer_share_game_bet", { p_slack_user: slackUserId, p_bet_id: action.value });
    const result = data as { ok?: boolean; reason?: string; already_shared?: boolean; stake?: number; guess?: string; roll?: number; payout?: number } | null;
    if (!result?.ok) return reply(actionError(result?.reason));
    if (result.already_shared) return reply("이미 채널에 공개한 결과예요.");
    if (!payload.channel?.id) return reply("공개할 채널을 찾지 못했어요.");
    const text = `<@${slackUserId}>님이 게임코너에서 ${result.guess === "odd" ? "홀" : "짝"}을 골랐어요. 피카츄 주사위 ${result.roll} · ${result.payout ? `+${result.payout - result.stake!}TP` : `-${result.stake}TP`}`;
    const posted = await postMessage({ channel: payload.channel.id, text, botToken: process.env.TRAINER_SLACK_BOT_TOKEN });
    return reply(posted.ok ? "채널에 결과를 공개했어요!" : "결과는 저장됐지만 채널 공개에는 실패했어요.");
  }
  return reply("알 수 없는 버튼이에요.");
}
