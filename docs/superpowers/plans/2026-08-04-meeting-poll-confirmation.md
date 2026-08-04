# Meeting Poll Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a Jarvis Slack confirmation when a meeting poll is confirmed and present the selected time with backup candidates.

**Architecture:** A small server-only notifier posts the confirmation and adds the requested custom reaction; its failure becomes a warning after the authoritative database update. The existing recommendation list stays the source of backups, filtered to exclude the confirmed start time.

**Tech Stack:** Next.js 16 Server Actions, TypeScript, Slack Web API, Vitest, existing WDS components.

## Global Constraints

- Use `SLACK_JARVIS_BOT_TOKEN` and `SLACK_ADMIN_CHANNEL_ID`; never fall back to another bot token.
- Send `<!channel>` and use custom reaction name `cb3dc3d2-fd74-4a3b-a9e1-f7ad58497090`.
- A Slack failure must not revert an already-confirmed poll.
- Keep the existing recommendation algorithm, data contract, and mobile one-column layout.

---

### Task 1: Send the confirmation through Jarvis

**Files:**

- Create: `src/lib/meeting-poll-confirmation.ts`
- Modify: `src/actions/meeting-poll.ts: confirmMeetingPoll`
- Test: `tests/meeting-poll-confirmation.test.ts`

**Interfaces:**

- Consumes: `postMessage({ channel, botToken, text })` and `addReaction({ channel, ts, emoji, botToken })` from `@/lib/slack/api`.
- Produces: `sendMeetingPollConfirmation({ id, title, startIso, durationMin }): Promise<string | undefined>`; a string is a user-facing warning.

- [ ] **Step 1: Write the failing test**

```ts
expect(await sendMeetingPollConfirmation({
  id: "poll-1", title: "8월 정기 회의", startIso: "2026-08-04T10:30:00.000Z", durationMin: 60,
})).toBeUndefined();
expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
  channel: "C_ADMIN", botToken: "xoxb-jarvis", text: expect.stringContaining("<!channel>"),
}));
expect(addReaction).toHaveBeenCalledWith({
  channel: "C_ADMIN", ts: "1", emoji: "cb3dc3d2-fd74-4a3b-a9e1-f7ad58497090", botToken: "xoxb-jarvis",
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/meeting-poll-confirmation.test.ts`

Expected: FAIL because `@/lib/meeting-poll-confirmation` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
const posted = await postMessage({ channel, botToken, text });
if (!posted.ok) return `슬랙 확정 알림은 실패했어요 (${posted.error})`;
const reacted = await addReaction({ channel, ts: posted.ts, emoji: CONFIRMATION_EMOJI, botToken });
return reacted.ok ? undefined : `슬랙 알림은 보냈지만 확인 이모지 반응은 실패했어요 (${reacted.error})`;
```

Call this helper only after the successful conditional update in `confirmMeetingPoll`, and join its warning with the existing Notion warning.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/meeting-poll-confirmation.test.ts`

Expected: PASS, including missing Slack configuration and reaction-failure warning cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/meeting-poll-confirmation.ts src/actions/meeting-poll.ts tests/meeting-poll-confirmation.test.ts
git commit -m "✨ 일정 확정 자비스 알림"
```

### Task 2: Distinguish confirmed time from backups

**Files:**

- Modify: `src/app/schedule/[id]/PollDetail.tsx: recommendations rendering`
- Modify: `src/app/schedule/schedule.module.css: confirmed and recommendation layout`
- Test: `tests/meeting-poll.test.ts`

**Interfaces:**

- Consumes: existing `recommendations`, `poll.confirmed_at`, and `poll.duration_min` values in `PollDetail`.
- Produces: a confirmed-time card and at most two recommended cards whose `startIso` differs from `poll.confirmed_at`.

- [ ] **Step 1: Write the failing test**

```ts
const backups = recommendations
  .filter((recommendation) => recommendation.startIso !== confirmedAt)
  .slice(0, 2);
expect(backups.map((recommendation) => recommendation.startIso)).toEqual([
  "2026-08-04T11:30:00.000Z", "2026-08-04T12:30:00.000Z",
]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/meeting-poll.test.ts`

Expected: FAIL because no helper exposes the confirmed-time backup selection.

- [ ] **Step 3: Write minimal implementation**

```tsx
const visibleRecommendations = poll.confirmed_at
  ? recommendations.filter((r) => r.startIso !== poll.confirmed_at).slice(0, 2)
  : recommendations;
```

Render `확정된 일정` in the existing blue confirmation surface. When confirmed, change the recommendation heading to `백업 플랜`, label cards `첫 번째 백업` and `두 번째 백업`, and render no section when `visibleRecommendations` is empty. Before confirmation, preserve all current copy and three-card behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/meeting-poll.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/schedule/[id]/PollDetail.tsx src/app/schedule/schedule.module.css tests/meeting-poll.test.ts
git commit -m "✨ 일정 확정 백업 플랜"
```

### Task 3: Verify the completed flow

**Files:**

- Verify: `tests/meeting-poll-confirmation.test.ts`
- Verify: `tests/meeting-poll.test.ts`
- Verify: `src/actions/meeting-poll.ts`
- Verify: `src/app/schedule/[id]/PollDetail.tsx`

**Interfaces:**

- Consumes: completed Tasks 1 and 2.
- Produces: validated behavior without unrelated worktree changes.

- [ ] **Step 1: Run focused tests**

Run: `pnpm vitest run tests/meeting-poll-confirmation.test.ts tests/meeting-poll.test.ts`

Expected: PASS.

- [ ] **Step 2: Run type check**

Run: `pnpm typecheck:v1`

Expected: PASS.

- [ ] **Step 3: Inspect the surgical diff**

Run: `git diff --check HEAD^ HEAD && git status --short`

Expected: no whitespace errors; only task files are staged or committed by this work.

## Self-review

- Task 1 covers Jarvis credentials, `<!channel>`, the custom reaction, and non-blocking warnings.
- Task 2 covers the confirmed-time card, two non-confirmed backups, and the original pre-confirmation view.
- The task interfaces agree on `sendMeetingPollConfirmation`; there are no placeholders.
