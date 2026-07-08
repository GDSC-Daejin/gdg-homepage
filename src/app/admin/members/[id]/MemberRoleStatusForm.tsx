"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { setMemberRole, setMemberStatus } from "@/actions/member";
import { Select } from "@/components/Select";
import type { Role, MemberStatus } from "@/lib/types";

export function MemberRoleStatusForm({
  userId,
  role,
  status,
}: {
  userId: string;
  role: Role;
  status: MemberStatus;
}) {
  const [roleValue, setRoleValue] = useState(role);
  const [statusValue, setStatusValue] = useState(status);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleRoleChange(e: ChangeEvent<HTMLSelectElement>) {
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

  function handleStatusChange(e: ChangeEvent<HTMLSelectElement>) {
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
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="역할"
          value={roleValue}
          onChange={handleRoleChange}
          disabled={pending}
          className="w-36"
        >
          <option value="admin">관리자</option>
          <option value="member">회원</option>
          <option value="applicant">지원자</option>
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
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
