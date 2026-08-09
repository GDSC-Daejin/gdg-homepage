import { createClient } from "@supabase/supabase-js";
import { homeBlocks } from "@/lib/trainer-market/blocks";
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
  return reply("🎒 포켓몬 메뉴\n버튼을 눌러 시작·출석·게임코너·상점·내 카드를 이용하세요.", homeBlocks());
}
