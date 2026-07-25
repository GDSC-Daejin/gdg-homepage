"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSlackLink } from "@/actions/slack-link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { suggestSlackMatch } from "@/lib/squirtle/backfill";
import type { SlackMemberSummary } from "@/lib/slack/api";

export type LinkableMember = {
  id: string;
  name: string;
  email: string | null;
  slack_user_id: string | null;
};

export function SlackLinkList({
  members,
  slackMembers,
}: {
  members: LinkableMember[];
  slackMembers: SlackMemberSummary[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [onlyUnlinked, setOnlyUnlinked] = useState(true);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const slackById = useMemo(
    () => new Map(slackMembers.map((m) => [m.id, m])),
    [slackMembers],
  );
  const unlinkedCount = members.filter((m) => !m.slack_user_id).length;

  // 미연결을 먼저 — 할 일이 위로 온다
  const unlinkedFirst = useMemo(() => {
    const rows = onlyUnlinked ? members.filter((m) => !m.slack_user_id) : members;
    return [...rows].sort((a, b) => {
      if (!a.slack_user_id !== !b.slack_user_id) return a.slack_user_id ? 1 : -1;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [members, onlyUnlinked]);

  function save(userId: string, slackUserId: string | null) {
    setError(undefined);
    startTransition(async () => {
      const result = await setSlackLink(userId, slackUserId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (members.length === 0) {
    return <EmptyState title="회원이 없어요" description="가입한 회원이 있으면 여기에서 연결해요." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-medium text-gray-700">
          전체 <span className="text-gray-400">{members.length}명</span>
          {unlinkedCount > 0 && (
            <span className="text-warning"> · 연결 안 됨 {unlinkedCount}명</span>
          )}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={onlyUnlinked}
            onChange={(e) => setOnlyUnlinked(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          미연결만 보기
        </label>
      </div>

      {error && (
        <div className="rounded-md border border-danger bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      {unlinkedFirst.length === 0 ? (
        <EmptyState
          title="모두 연결됐어요"
          description="새로 가입한 회원이 생기면 여기에 나타나요."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {unlinkedFirst.map((member) => {
            const linked = member.slack_user_id ? slackById.get(member.slack_user_id) : undefined;
            const suggested = suggestSlackMatch(member.email, slackMembers);
            const value = picked[member.id] ?? member.slack_user_id ?? suggested ?? "";

            return (
              <Card key={member.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{member.name || "이름 없음"}</p>
                    {member.slack_user_id ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-500 px-2 py-0.5 text-xs font-medium">
                        {linked ? `@${linked.name}` : member.slack_user_id}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-warning-soft text-warning px-2 py-0.5 text-xs font-medium">
                        연결 안 됨
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {member.email || "가입 이메일 없음"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <select
                    value={value}
                    disabled={pending}
                    onChange={(e) => setPicked({ ...picked, [member.id]: e.target.value })}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 disabled:opacity-50"
                  >
                    <option value="">슬랙 계정 선택</option>
                    {slackMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.email ? ` (${s.email})` : ""}
                        {s.id === suggested ? " · 이메일 일치" : ""}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={pending || !value || value === member.slack_user_id}
                    onClick={() => save(member.id, value)}
                  >
                    연결
                  </Button>

                  {member.slack_user_id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => save(member.id, null)}
                    >
                      해제
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
