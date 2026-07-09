"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  setMemberRole,
  setMemberStatus,
  updateMemberProfile,
} from "@/actions/member";
import { Select, type SelectChangeEvent } from "@/components/Select";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { formatKst, formatKstDate } from "@/lib/format";
import type { Profile, Role, MemberStatus } from "@/lib/types";

const roleLabel: Record<Role, string> = {
  admin: "관리자",
  member: "회원",
  applicant: "지원자",
};

const statusLabel: Record<MemberStatus, string> = {
  active: "활동",
  dormant: "휴면",
  withdrawn: "탈퇴",
};

const statusTone: Record<MemberStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  dormant: "neutral",
  withdrawn: "danger",
};

const roleTone: Record<Role, "primary" | "neutral" | "warning"> = {
  admin: "primary",
  member: "neutral",
  applicant: "warning",
};

export function MemberRow({ member }: { member: Profile }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(member.name);
  const [studentNo, setStudentNo] = useState(member.student_no);
  const [major, setMajor] = useState(member.major);
  const [phone, setPhone] = useState(member.phone);
  const [interests, setInterests] = useState(member.interests.join(", "));
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string>();
  const [profilePending, startProfileTransition] = useTransition();

  function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileError(undefined);
    setProfileSaved(false);
    startProfileTransition(async () => {
      const result = await updateMemberProfile(member.id, {
        name,
        student_no: studentNo,
        major,
        phone,
        interests: interests
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      });
      if (result?.error) setProfileError(result.error);
      else setProfileSaved(true);
    });
  }

  function handleRoleChange(e: SelectChangeEvent) {
    const next = e.target.value as Role;
    setRole(next);
    setError(undefined);
    startTransition(async () => {
      const result = await setMemberRole(member.id, next);
      if (result?.error) {
        setError(result.error);
        setRole(member.role);
      }
    });
  }

  function handleStatusChange(e: SelectChangeEvent) {
    const next = e.target.value as MemberStatus;
    setStatus(next);
    setError(undefined);
    startTransition(async () => {
      const result = await setMemberStatus(member.id, next);
      if (result?.error) {
        setError(result.error);
        setStatus(member.status);
      }
    });
  }

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
        onClick={() => dialogRef.current?.showModal()}
      >
        <td className="px-4 py-3">
          <Link
            href={`/admin/members/${member.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-primary hover:underline"
          >
            {member.name || "(이름 없음)"}
          </Link>
        </td>
        <td className="px-4 py-3 text-gray-700">{member.student_no || "-"}</td>
        <td className="px-4 py-3 text-gray-700">{member.major || "-"}</td>
        <td className="px-4 py-3">
          <Badge tone={roleTone[role]}>{roleLabel[role]}</Badge>
        </td>
        <td className="px-4 py-3">
          <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
        </td>
        <td className="px-4 py-3 text-gray-500">
          {formatKstDate(member.joined_at)}
        </td>
      </tr>

      {mounted &&
        createPortal(
          <dialog
            ref={dialogRef}
            onClick={(e) =>
              e.target === dialogRef.current && dialogRef.current.close()
            }
            className="fixed top-1/2 left-[calc(50%+7.5rem)] m-0 hidden max-h-[85vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 open:flex flex-col overflow-y-auto rounded-xl border border-gray-200 p-6 shadow-card backdrop:bg-black/40"
          >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            {member.name || "(이름 없음)"}
          </h2>
          <p className="text-xs text-gray-500">
            가입일 {formatKst(member.joined_at)}
          </p>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-8">
          <form
            onSubmit={handleProfileSubmit}
            className="flex flex-col gap-3"
          >
            <p className="text-sm font-semibold text-gray-900">프로필</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={profilePending}
              />
              <Input
                label="학번"
                value={studentNo}
                onChange={(e) => setStudentNo(e.target.value)}
                disabled={profilePending}
              />
              <Input
                label="전공"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                disabled={profilePending}
              />
              <Input
                label="전화번호"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={profilePending}
              />
              <Input
                label="관심 분야 (쉼표로 구분)"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                disabled={profilePending}
                className="col-span-2"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" size="sm" disabled={profilePending}>
                프로필 저장
              </Button>
              {profileSaved && !profileError && (
                <p className="text-xs text-success">저장했어요</p>
              )}
              {profileError && <p className="text-xs text-danger">{profileError}</p>}
            </div>
          </form>

          <div className="flex flex-col gap-3 border-l border-gray-100 pl-8">
            <p className="text-sm font-semibold text-gray-900">역할 · 상태</p>
            <div className="flex items-center gap-2">
              <Badge tone={roleTone[role]}>{roleLabel[role]}</Badge>
              <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
            </div>
            <Select
              label="역할"
              value={role}
              onChange={handleRoleChange}
              disabled={pending}
            >
              <option value="admin">관리자</option>
              <option value="member">회원</option>
              <option value="applicant">지원자</option>
            </Select>
            <Select
              label="상태"
              value={status}
              onChange={handleStatusChange}
              disabled={pending}
            >
              <option value="active">활동</option>
              <option value="dormant">휴면</option>
              <option value="withdrawn">탈퇴</option>
            </Select>
            <p className="text-xs text-gray-400">
              변경 즉시 사이트에 반영돼요.
            </p>
            {error && <p className="text-xs text-danger">{error}</p>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <Link
            href={`/admin/members/${member.id}`}
            className="text-xs text-primary hover:underline"
          >
            상세 페이지로 이동
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => dialogRef.current?.close()}
          >
            닫기
            </Button>
          </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
