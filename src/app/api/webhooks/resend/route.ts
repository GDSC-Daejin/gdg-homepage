import { createClient } from "@supabase/supabase-js";
import { emailStatusForEvent, verifyResendSignature } from "@/lib/resend-webhook";

export const runtime = "nodejs";

function eventTime(value: unknown): string {
  const time = typeof value === "string" ? new Date(value) : null;
  return time && Number.isFinite(time.getTime()) ? time.toISOString() : new Date().toISOString();
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // 설정 누락은 서명 오류와 구분한다. 5xx면 Resend가 재시도하므로 시크릿을 넣은 뒤 이벤트가 복구된다.
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET이 설정되지 않았어요");
    return Response.json({ error: "webhook not configured" }, { status: 500 });
  }

  const payload = await request.text();
  if (verifyResendSignature(payload, request.headers, secret) !== "ok") {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { type?: unknown; created_at?: unknown; data?: { email_id?: unknown } | null };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }
  const status = emailStatusForEvent(event?.type);
  const emailId = typeof event?.data?.email_id === "string" ? event.data.email_id : null;
  const eventId = request.headers.get("svix-id")!;
  // 메일 상태와 무관한 이벤트(email.sent·opened 등)는 받았다고만 답한다.
  if (!status || !emailId) return Response.json({ ok: true, ignored: true });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "server configuration missing" }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: log, error: logError } = await supabase
    .from("application_email_logs")
    .select("id")
    .eq("provider_email_id", emailId)
    .maybeSingle();
  if (logError) return Response.json({ error: "email log lookup failed" }, { status: 500 });
  // 모집 메일이 아닌 Resend 메일(다른 기능의 발송)은 기록 대상이 아니다.
  if (!log) return Response.json({ ok: true, ignored: true });

  const occurredAt = eventTime(event.created_at);
  const { error: eventError } = await supabase.from("application_email_events").insert({
    email_log_id: log.id,
    provider_event_id: eventId,
    provider_email_id: emailId,
    event_type: event.type,
    occurred_at: occurredAt,
    payload: { type: event.type, created_at: event.created_at, email_id: emailId },
  });
  // 같은 svix-id 재전송(23505)이어도 상태 갱신은 다시 시도한다 — 이전 시도가 이벤트 저장 뒤 상태 갱신에서 실패했을 수 있다.
  if (eventError && eventError.code !== "23505") {
    return Response.json({ error: "event save failed" }, { status: 500 });
  }

  // 이벤트는 순서가 뒤바뀌어 올 수 있다. 이미 반영한 이벤트보다 오래된 이벤트로 상태를 되돌리지 않는다.
  const { error: updateError } = await supabase
    .from("application_email_logs")
    .update({
      status,
      last_event_at: occurredAt,
      ...(status === "delivered" ? { delivered_at: occurredAt } : {}),
    })
    .eq("id", log.id)
    .or(`last_event_at.is.null,last_event_at.lte."${occurredAt}"`);
  if (updateError) return Response.json({ error: "email status update failed" }, { status: 500 });
  return Response.json({ ok: true, duplicate: eventError?.code === "23505" || undefined });
}
