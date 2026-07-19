"use client";

import { useState, useTransition } from "react";
import {
  setMemberRole,
  setMemberPosition,
  setMemberStatus,
} from "@/actions/member";
import { Select, type SelectChangeEvent } from "@/components/Select";
import { Badge } from "@/components/Badge";
import {
  POSITION_LABELS,
  type Role,
  type Position,
  type MemberStatus,
} from "@/lib/types";

const roleLabel: Record<Role, string> = {
  organizer: "오거나이저",
  team_member: "팀 멤버",
  member: "회원",
  applicant: "지원자",
};

const statusLabel: Record<MemberStatus, string> = {
  active: "활동",
  dormant: "휴면",
  withdrawn: "탈퇴",
};

const roleTone: Record<Role, "primary" | "success" | "neutral" | "warning"> = {
  organizer: "primary",
  team_member: "success",
  member: "neutral",
  applicant: "warning",
};

const statusTone: Record<MemberStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  dormant: "neutral",
  withdrawn: "danger",
};

export function MemberRoleStatusForm({
  userId,
  role,
  position,
  status,
  organizerTaken,
}: {
  userId: string;
  role: Role;
  position: Position | null;
  status: MemberStatus;
  organizerTaken: boolean;
}) {
  const [roleValue, setRoleValue] = useState(role);
  const [positionValue, setPositionValue] = useState<Position | "">(
    position ?? "",
  );
  const [statusValue, setStatusValue] = useState(status);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleRoleChange(e: SelectChangeEvent) {
    const value = e.target.value as Role;
    setRoleValue(value);
    setError(undefined);
    startTransition(async () => {
      const result = await setMemberRole(userId, value);
      if (result?.error) {
        setError(result.error);
        setRoleValue(role);
      }
    });
  }

  function handlePositionChange(e: SelectChangeEvent) {
    const value = e.target.value as Position;
    setPositionValue(value);
    setError(undefined);
    startTransition(async () => {
      const result = await setMemberPosition(userId, value);
      if (result?.error) {
        setError(result.error);
        setPositionValue(position ?? "");
      }
    });
  }

  function handleStatusChange(e: SelectChangeEvent) {
    const value = e.target.value as MemberStatus;
    setStatusValue(value);
    setError(undefined);
    startTransition(async () => {
      const result = await setMemberStatus(userId, value);
      if (result?.error) {
        setError(result.error);
        setStatusValue(status);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
      <p className="text-sm font-semibold text-gray-900">역할 · 포지션 · 상태</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={roleTone[roleValue]}>{roleLabel[roleValue]}</Badge>
          {positionValue && (
            <Badge tone="neutral">{POSITION_LABELS[positionValue]}</Badge>
          )}
          <Badge tone={statusTone[statusValue]}>{statusLabel[statusValue]}</Badge>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label="역할"
            value={roleValue}
            onChange={handleRoleChange}
            disabled={pending}
            className="w-36"
          >
            <option value="organizer" disabled={organizerTaken}>
              오거나이저{organizerTaken ? " (이미 지정됨)" : ""}
            </option>
            <option value="team_member">팀 멤버</option>
            <option value="member">회원</option>
            <option value="applicant">지원자</option>
          </Select>
          <Select
            label="포지션"
            value={positionValue}
            onChange={handlePositionChange}
            disabled={pending}
            className="w-36"
          >
            <option value="" disabled>
              선택
            </option>
            <option value="frontend">프론트엔드</option>
            <option value="backend">백엔드</option>
            <option value="designer">디자이너</option>
            <option value="beginner">비기너</option>
          </Select>
          <Select
            label="상태"
            value={statusValue}
            onChange={handleStatusChange}
            disabled={pending}
            className="w-36"
          >
            <option value="active">활동</option>
            <option value="dormant">휴면</option>
            <option value="withdrawn">탈퇴</option>
          </Select>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        역할·상태는 변경 즉시 사이트에 반영돼요.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
