export type MemberEmail = { id: string; email: string };

/**
 * 어드민 수동 연결 화면에서 드롭다운 기본값으로 쓸 슬랙 계정을 고른다.
 * 슬랙 이메일과 가입 이메일이 갈리는 회원(슬랙은 naver, 가입은 gmail)은 null이 나온다 — 손으로 골라야 한다.
 */
export function suggestSlackMatch(
  memberEmail: string | null,
  slackMembers: Array<{ id: string; email: string }>,
): string | null {
  const email = (memberEmail ?? "").trim().toLowerCase();
  if (!email) return null;
  return slackMembers.find((m) => m.email && m.email.toLowerCase() === email)?.id ?? null;
}

export function matchSlackUsers(
  slackEmails: Map<string, string>,
  members: MemberEmail[],
): Array<{ id: string; slack_user_id: string }> {
  const byEmail = new Map<string, string | null>();
  for (const member of members) {
    const email = member.email.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, byEmail.has(email) ? null : member.id);
  }

  const matches: Array<{ id: string; slack_user_id: string }> = [];
  for (const [slackUserId, email] of slackEmails) {
    const memberId = byEmail.get(email);
    if (memberId) matches.push({ id: memberId, slack_user_id: slackUserId });
  }
  return matches;
}
