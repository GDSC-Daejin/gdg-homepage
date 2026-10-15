import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function verifySignature(payload: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const encodedSecret = secret.replace(/^whsec_/, "");
  const key = Buffer.from(encodedSecret, "base64");
  const signed = `${id}.${timestamp}.${payload}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");
  return signature.split(" ").some((value) => {
    const actual = value.replace(/^v1,/, "");
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });
}

function statusForEvent(type: string) {
  return {
    "email.delivered": "delivered",
    "email.delivery_delayed": "delivery_delayed",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
  }[type] ?? null;
}

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifySignature(payload, request.headers)) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: {
    type?: string;
    created_at?: string;
    data?: { email_id?: string };
  };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  const status = statusForEvent(event.type ?? "");
  const emailId = event.data?.email_id;
  const eventId = request.headers.get("svix-id");
  if (!status || !emailId || !eventId) return Response.json({ ok: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "server configuration missing" }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: log } = await supabase
    .from("application_email_logs")
    .select("id")
    .eq("provider_email_id", emailId)
    .maybeSingle();
  if (!log) return Response.json({ ok: true });

  const { error: eventError } = await supabase.from("application_email_events").insert({
    email_log_id: log.id,
    provider_event_id: eventId,
    provider_email_id: emailId,
    event_type: event.type,
    occurred_at: event.created_at ?? new Date().toISOString(),
    payload: { type: event.type, created_at: event.created_at, email_id: emailId },
  });
  if (eventError?.code === "23505") return Response.json({ ok: true });
  if (eventError) return Response.json({ error: "event save failed" }, { status: 500 });

  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("application_email_logs").update({
    status,
    last_event_at: now,
    ...(status === "delivered" ? { delivered_at: now } : {}),
  }).eq("id", log.id);
  if (updateError) return Response.json({ error: "email status update failed" }, { status: 500 });
  return Response.json({ ok: true });
}
