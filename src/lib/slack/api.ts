const BASE = "https://slack.com/api";

export type SlackResult = { ok: true; ts: string } | { ok: false; error: string };

type SlackResponse = { ok: boolean; error?: string; ts?: string };

async function call(method: string, body: Record<string, unknown>): Promise<SlackResponse> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: "missing_token" };

  try {
    const res = await fetch(`${BASE}/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return (await res.json()) as SlackResponse;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : "fetch_failed" };
  }
}

function toResult(res: SlackResponse): SlackResult {
  if (!res.ok || !res.ts) return { ok: false, error: res.error ?? "unknown_error" };
  return { ok: true, ts: res.ts };
}

export async function postMessage(opts: { channel: string; text: string; threadTs?: string }): Promise<SlackResult> {
  const body: Record<string, unknown> = { channel: opts.channel, text: opts.text };
  if (opts.threadTs) body.thread_ts = opts.threadTs;
  return toResult(await call("chat.postMessage", body));
}

export async function updateMessage(opts: { channel: string; ts: string; text: string }): Promise<SlackResult> {
  return toResult(await call("chat.update", { channel: opts.channel, ts: opts.ts, text: opts.text }));
}

export async function addReaction(opts: { channel: string; ts: string; emoji: string }): Promise<{ ok: boolean; error?: string }> {
  const res = await call("reactions.add", { channel: opts.channel, timestamp: opts.ts, name: opts.emoji });
  if (!res.ok && res.error === "already_reacted") return { ok: true };
  return { ok: res.ok, error: res.error };
}

type SlackMember = {
  id: string;
  is_bot?: boolean;
  deleted?: boolean;
  profile?: { email?: string; display_name?: string; real_name?: string };
};

export type SlackMemberSummary = { id: string; name: string; email: string };

/** 워크스페이스의 사람 멤버 전체. 이메일이 없어도 포함한다 — 수동 연결 대상이다. */
export async function listWorkspaceMembers(): Promise<SlackMemberSummary[]> {
  const members: SlackMemberSummary[] = [];
  let cursor = "";

  do {
    const res = (await call("users.list", { limit: 200, cursor })) as SlackResponse & {
      members?: SlackMember[];
      response_metadata?: { next_cursor?: string };
    };
    if (!res.ok) break;

    for (const member of res.members ?? []) {
      if (member.is_bot || member.deleted) continue;
      members.push({
        id: member.id,
        name: member.profile?.display_name || member.profile?.real_name || member.id,
        email: (member.profile?.email ?? "").toLowerCase(),
      });
    }
    cursor = res.response_metadata?.next_cursor ?? "";
  } while (cursor);

  return members;
}

/** 자동 백필용 — slackUserId → 이메일. 이메일 없는 멤버는 매칭 대상이 아니라 제외한다. */
export async function listUserEmails(): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  for (const member of await listWorkspaceMembers()) {
    if (member.email) emails.set(member.id, member.email);
  }
  return emails;
}
