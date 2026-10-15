import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { emailStatusForEvent, verifyResendSignature } from "@/lib/resend-webhook";
import { POST } from "@/app/api/webhooks/resend/route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

// 테스트 전용 가짜 시크릿 — 실제 Resend 시크릿이 아니다.
const SECRET = `whsec_${Buffer.from("test-only-webhook-secret").toString("base64")}`;

function sign(id: string, timestamp: string, body: string, secret = SECRET) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

function signedHeaders(body: string, opts: { id?: string; timestamp?: number; signature?: string } = {}) {
  const id = opts.id ?? "msg_1";
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  return new Headers({
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": opts.signature ?? `v1,${sign(id, timestamp, body)}`,
  });
}

function webhookRequest(body: string, headers: Headers) {
  return new Request("https://example.com/api/webhooks/resend", { method: "POST", body, headers });
}

function deliveredEvent(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "email.delivered",
    created_at: "2026-10-15T03:00:00.000Z",
    data: { email_id: "re_email_1" },
    ...overrides,
  });
}

type SupabaseStub = ReturnType<typeof supabaseStub>;

function supabaseStub(opts: {
  log?: { id: string } | null;
  logError?: { code: string } | null;
  insertError?: { code: string } | null;
  updateError?: { code: string } | null;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.log === undefined ? { id: "log-1" } : opts.log, error: opts.logError ?? null });
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const or = vi.fn().mockResolvedValue({ error: opts.updateError ?? null });
  const updateEq = vi.fn(() => ({ or }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn((table: string) => {
    if (table === "application_email_events") return { insert };
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      update,
    };
  });
  return { from, insert, update, updateEq, or };
}

function useSupabase(stub: SupabaseStub) {
  vi.mocked(createClient).mockReturnValue(stub as never);
}

describe("verifyResendSignature", () => {
  const body = deliveredEvent();

  it("Svix 서명이 맞으면 통과한다", () => {
    expect(verifyResendSignature(body, signedHeaders(body), SECRET)).toBe("ok");
  });

  it("키 교체 중 여러 서명 중 하나만 맞아도 통과한다", () => {
    const headers = signedHeaders(body);
    headers.set("svix-signature", `v1,${"A".repeat(44)} ${headers.get("svix-signature")}`);
    expect(verifyResendSignature(body, headers, SECRET)).toBe("ok");
  });

  it("본문이 바뀌거나 다른 시크릿으로 서명하면 거절한다", () => {
    expect(verifyResendSignature(`${body} `, signedHeaders(body), SECRET)).toBe("invalid_signature");
    const other = `whsec_${Buffer.from("another-test-secret").toString("base64")}`;
    expect(verifyResendSignature(body, signedHeaders(body), other)).toBe("invalid_signature");
  });

  it("v1이 아닌 서명 버전이나 길이가 다른 서명은 거절한다", () => {
    const headers = signedHeaders(body);
    const value = headers.get("svix-signature")!.replace(/^v1,/, "");
    headers.set("svix-signature", `v2,${value}`);
    expect(verifyResendSignature(body, headers, SECRET)).toBe("invalid_signature");
    headers.set("svix-signature", "v1,short");
    expect(verifyResendSignature(body, headers, SECRET)).toBe("invalid_signature");
  });

  it("5분을 넘긴 타임스탬프는 서명이 맞아도 거절한다(재전송 공격)", () => {
    const old = Math.floor(Date.now() / 1000) - 301;
    expect(verifyResendSignature(body, signedHeaders(body, { timestamp: old }), SECRET)).toBe("stale_timestamp");
  });

  it("Svix 헤더가 빠지면 거절한다", () => {
    const headers = signedHeaders(body);
    headers.delete("svix-id");
    expect(verifyResendSignature(body, headers, SECRET)).toBe("missing_headers");
  });

  it("상수 시간 비교를 사용한다", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile("src/lib/resend-webhook.ts", "utf8");
    expect(source).toContain("timingSafeEqual");
  });
});

describe("emailStatusForEvent", () => {
  it("상태를 바꾸는 이벤트만 매핑한다", () => {
    expect(emailStatusForEvent("email.delivered")).toBe("delivered");
    expect(emailStatusForEvent("email.failed")).toBe("failed");
    expect(emailStatusForEvent("email.opened")).toBeNull();
    expect(emailStatusForEvent("__proto__")).toBeNull();
    expect(emailStatusForEvent({})).toBeNull();
  });
});

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("시크릿이 없으면 500으로 답하고 DB에 접근하지 않는다", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const body = deliveredEvent();
    const response = await POST(webhookRequest(body, signedHeaders(body)));
    expect(response.status).toBe(500);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("서명이 틀리면 401로 거절하고 DB에 접근하지 않는다", async () => {
    const body = deliveredEvent();
    const response = await POST(webhookRequest(body, signedHeaders(body, { signature: `v1,${"B".repeat(44)}` })));
    expect(response.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("서명은 맞지만 JSON이 아니면 400", async () => {
    const body = "not-json";
    const response = await POST(webhookRequest(body, signedHeaders(body)));
    expect(response.status).toBe(400);
  });

  it("처음 보는 이벤트 종류는 200으로 받고 아무것도 바꾸지 않는다", async () => {
    const body = deliveredEvent({ type: "email.opened" });
    const response = await POST(webhookRequest(body, signedHeaders(body)));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ignored: true });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("전달 완료 이벤트를 저장하고 이벤트 시각 기준으로 상태를 갱신한다", async () => {
    const stub = supabaseStub();
    useSupabase(stub);
    const body = deliveredEvent();
    const response = await POST(webhookRequest(body, signedHeaders(body, { id: "msg_delivered" })));

    expect(response.status).toBe(200);
    expect(stub.insert).toHaveBeenCalledWith(expect.objectContaining({
      email_log_id: "log-1",
      provider_event_id: "msg_delivered",
      event_type: "email.delivered",
      occurred_at: "2026-10-15T03:00:00.000Z",
    }));
    expect(stub.update).toHaveBeenCalledWith({
      status: "delivered",
      last_event_at: "2026-10-15T03:00:00.000Z",
      delivered_at: "2026-10-15T03:00:00.000Z",
    });
    expect(stub.updateEq).toHaveBeenCalledWith("id", "log-1");
    // 더 늦게 반영된 이벤트를 오래된 이벤트로 덮어쓰지 않는 조건
    expect(stub.or).toHaveBeenCalledWith('last_event_at.is.null,last_event_at.lte."2026-10-15T03:00:00.000Z"');
  });

  it("같은 svix-id 재전송은 중복 저장 없이 상태 갱신만 다시 시도하고 200", async () => {
    const stub = supabaseStub({ insertError: { code: "23505" } });
    useSupabase(stub);
    const body = deliveredEvent();
    const response = await POST(webhookRequest(body, signedHeaders(body)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, duplicate: true });
    expect(stub.update).toHaveBeenCalledTimes(1);
  });

  it("모집 메일 로그에 없는 메일은 200으로 무시한다", async () => {
    const stub = supabaseStub({ log: null });
    useSupabase(stub);
    const body = deliveredEvent();
    const response = await POST(webhookRequest(body, signedHeaders(body)));

    expect(response.status).toBe(200);
    expect(stub.insert).not.toHaveBeenCalled();
  });

  it("DB 조회·저장·갱신이 실패하면 500으로 답해 Resend가 재시도하게 한다", async () => {
    for (const stub of [
      supabaseStub({ logError: { code: "XX000" } }),
      supabaseStub({ insertError: { code: "XX000" } }),
      supabaseStub({ updateError: { code: "XX000" } }),
    ]) {
      useSupabase(stub);
      const body = deliveredEvent();
      const response = await POST(webhookRequest(body, signedHeaders(body)));
      expect(response.status).toBe(500);
    }
  });

  it("이벤트 시각이 없거나 깨져 있으면 수신 시각을 쓴다", async () => {
    const stub = supabaseStub();
    useSupabase(stub);
    const body = deliveredEvent({ type: "email.bounced", created_at: "not-a-date" });
    const response = await POST(webhookRequest(body, signedHeaders(body)));

    expect(response.status).toBe(200);
    const [{ last_event_at }] = stub.update.mock.calls[0] as unknown as [{ last_event_at: string }];
    expect(Number.isFinite(new Date(last_event_at).getTime())).toBe(true);
    expect(stub.update).toHaveBeenCalledWith(expect.not.objectContaining({ delivered_at: expect.anything() }));
  });
});
