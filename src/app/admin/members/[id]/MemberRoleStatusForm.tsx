"use client";

import { useState, useTransition } from "react";
import { approveMember } from "@/actions/member";
import { Select } from "@/components/Select";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import {
  POSITION_LABELS,
  ACADEMIC_STATUS_LABELS,
  type Role,
  type Position,
  type MemberStatus,
  type AcademicStatus,
} from "@/lib/types";
import {
  MEMBER_ACADEMIC_STATUS_TONES,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLE_TONES,
  MEMBER_STATUS_LABELS,
  MEMBER_STATUS_TONES,
  useMemberAttributes,
} from "../member-editor";

export function MemberRoleStatusForm({
  userId,
  role,
  position,
  status,
  academicStatus,
  approvedAt,
  organizerTaken,
}: {
  userId: string;
  role: Role;
  position: Position | null;
  status: MemberStatus;
  academicStatus: AcademicStatus | null;
  approvedAt: string | null;
  organizerTaken: boolean;
}) {
  const {
    values: {
      role: roleValue,
      position: positionValue,
      status: statusValue,
      academicStatus: academicStatusValue,
    },
    error,
    pending,
    change,
    clearError,
  } = useMemberAttributes(userId, {
    role,
    position: position ?? "",
    status,
    academicStatus: academicStatus ?? null,
  });

  const [approvePending, startApproveTransition] = useTransition();
  const [approveError, setApproveError] = useState<string>();

  function handleApprove() {
    clearError();
    setApproveError(undefined);
    startApproveTransition(async () => {
      const result = await approveMember(userId);
      if (result?.error) setApproveError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
      <p className="text-sm font-semibold text-gray-900">역할 · 포지션 · 상태 · 재학여부</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          {!approvedAt && <Badge tone="warning">승인 대기</Badge>}
          <Badge tone={MEMBER_ROLE_TONES[roleValue]}>{MEMBER_ROLE_LABELS[roleValue]}</Badge>
          {positionValue && (
            <Badge tone="neutral">{POSITION_LABELS[positionValue]}</Badge>
          )}
          <Badge tone={MEMBER_STATUS_TONES[statusValue]}>{MEMBER_STATUS_LABELS[statusValue]}</Badge>
          {academicStatusValue && (
            <Badge tone={MEMBER_ACADEMIC_STATUS_TONES[academicStatusValue]}>
              {ACADEMIC_STATUS_LABELS[academicStatusValue]}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {!approvedAt && (
            <Button type="button" variant="primary" disabled={approvePending || pending} onClick={handleApprove}>
              승인
            </Button>
          )}
          <Select
            label="역할"
            value={roleValue}
            onChange={(e) => change("role", e.target.value)}
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
            onChange={(e) => change("position", e.target.value)}
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
            onChange={(e) => change("status", e.target.value)}
            disabled={pending}
            className="w-36"
          >
            <option value="active">활동</option>
            <option value="dormant">휴면</option>
            <option value="withdrawn">탈퇴</option>
          </Select>
          <Select
            label="재학여부"
            value={academicStatusValue ?? ""}
            onChange={(e) => change("academicStatus", e.target.value)}
            disabled={pending}
            className="w-36"
          >
            <option value="">선택 안 함</option>
            <option value="enrolled">재학</option>
            <option value="leave">휴학</option>
            <option value="graduated">졸업</option>
            <option value="completed">수료</option>
          </Select>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        역할·상태는 변경 즉시 사이트에 반영돼요.
      </p>
      {(approveError ?? error) && <p className="text-xs text-danger">{approveError ?? error}</p>}
    </div>
  );
}
