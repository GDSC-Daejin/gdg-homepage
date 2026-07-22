"use client";

import { useState, type FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";

export function MemberFilters({
  q,
  role,
  status,
  academicStatus,
  pending,
}: {
  q?: string;
  role?: string;
  status?: string;
  academicStatus?: string;
  pending?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [qValue, setQValue] = useState(q ?? "");
  const [roleValue, setRoleValue] = useState(role ?? "");
  const [statusValue, setStatusValue] = useState(status ?? "");
  const [academicStatusValue, setAcademicStatusValue] = useState(academicStatus ?? "");
  const [pendingValue, setPendingValue] = useState(pending ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (qValue) params.set("q", qValue);
    if (roleValue) params.set("role", roleValue);
    if (statusValue) params.set("status", statusValue);
    if (academicStatusValue) params.set("academicStatus", academicStatusValue);
    if (pendingValue) params.set("pending", pendingValue);
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Input
        label="검색"
        placeholder="이름 또는 학번"
        value={qValue}
        onChange={(e) => setQValue(e.target.value)}
        className="w-56"
      />
      <div className="w-36 shrink-0">
        <Select
          label="역할"
          value={roleValue}
          onChange={(e) => setRoleValue(e.target.value)}
        >
          <option value="">전체</option>
          <option value="organizer">오거나이저</option>
          <option value="team_member">팀 멤버</option>
          <option value="member">회원</option>
          <option value="applicant">지원자</option>
        </Select>
      </div>
      <div className="w-36 shrink-0">
        <Select
          label="재학여부"
          value={academicStatusValue}
          onChange={(e) => setAcademicStatusValue(e.target.value)}
        >
          <option value="">전체</option>
          <option value="enrolled">재학</option>
          <option value="leave">휴학</option>
          <option value="graduated">졸업</option>
          <option value="completed">수료</option>
        </Select>
      </div>
      <div className="w-36 shrink-0">
        <Select
          label="상태"
          value={statusValue}
          onChange={(e) => setStatusValue(e.target.value)}
        >
          <option value="">전체</option>
          <option value="active">활동</option>
          <option value="dormant">휴면</option>
          <option value="withdrawn">탈퇴</option>
        </Select>
      </div>
      <div className="w-36 shrink-0">
        <Select
          label="승인"
          value={pendingValue}
          onChange={(e) => setPendingValue(e.target.value)}
        >
          <option value="">전체</option>
          <option value="1">승인 대기만 보기</option>
        </Select>
      </div>
      <Button type="submit" variant="primary">
        검색
      </Button>
    </form>
  );
}
