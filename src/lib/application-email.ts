import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { EmailSendResult } from "@/lib/email";

export type ApplicationEmailKind =
  | "interview_invite"
  | "interview_confirmation"
  | "interview_cancellation"
  | "result"
  | "onboarding_invite";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recordApplicationEmail(params: {
  applicationId: string;
  kind: ApplicationEmailKind;
  recipientEmail: string;
  result: EmailSendResult;
  slotId?: string | null;
}) {
  const client = serviceClient();
  if (!client) {
    console.warn("[application-email] SUPABASE_SERVICE_ROLE_KEY가 없어 메일 이력을 남기지 못했어요");
    return;
  }

  const requestedAt = new Date().toISOString();
  const status = params.result.skipped
    ? "not_configured"
    : params.result.sent
      ? "requested"
      : "failed";

  // 메일은 이미 나갔으므로 이력 저장 실패가 지원서 처리 자체를 실패시키지는 않는다. 대신 숨기지 않고 남긴다.
  const { error } = await client.from("application_email_logs").insert({
    application_id: params.applicationId,
    slot_id: params.slotId ?? null,
    kind: params.kind,
    recipient_email: params.recipientEmail,
    provider_email_id: params.result.providerEmailId ?? null,
    status,
    error: params.result.error ?? null,
    requested_at: requestedAt,
  });
  if (error) {
    console.error("[application-email] 메일 이력 저장 실패", { kind: params.kind, applicationId: params.applicationId, code: error.code });
  }
}
