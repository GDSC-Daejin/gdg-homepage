import { createClient } from "@supabase/supabase-js";
import { ballCountMessage } from "@/lib/pokedex/messages";
import { verifySlackSignature } from "@/lib/slack/verify";

function response(text: string) {
  return Response.json({ response_type: "ephemeral", text });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signingSecret = process.env.POKEDEX_SLACK_SIGNING_SECRET;
  if (!signingSecret || !verifySlackSignature({ rawBody, timestamp: request.headers.get("x-slack-request-timestamp"), signature: request.headers.get("x-slack-signature"), signingSecret })) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }
  const slackUserId = new URLSearchParams(rawBody).get("user_id");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!slackUserId || !url || !key) return Response.json({ error: "not_configured" }, { status: 500 });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await supabase.from("profiles").select("id").eq("slack_user_id", slackUserId).maybeSingle();
  if (!profile) return response(`<@${slackUserId}>의 연결된 서비스 계정을 찾지 못했어요.`);

  const { data: inventory } = await supabase
    .from("pokemon_ball_inventory")
    .select("quantity")
    .eq("user_id", profile.id)
    .eq("ball_slug", "poke_ball")
    .maybeSingle();
  return response(ballCountMessage(slackUserId, inventory?.quantity ?? 0));
}
