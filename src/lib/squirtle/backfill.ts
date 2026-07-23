export type MemberEmail = { id: string; email: string };

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
