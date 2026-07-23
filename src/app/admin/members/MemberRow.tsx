"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  setMemberRole,
  setMemberPosition,
  setMemberStatus,
  setMemberAcademicStatus,
  updateMemberProfile,
  deleteMember,
} from "@/actions/member";
import { Select, type SelectChangeEvent } from "@/components/Select";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { formatKstDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  POSITION_LABELS,
  ACADEMIC_STATUS_LABELS,
  type Profile,
  type Role,
  type Position,
  type MemberStatus,
  type AcademicStatus,
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

const statusTone: Record<MemberStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  dormant: "neutral",
  withdrawn: "danger",
};

const roleTone: Record<Role, "primary" | "success" | "neutral" | "warning"> = {
  organizer: "primary",
  team_member: "success",
  member: "neutral",
  applicant: "warning",
};

const academicStatusTone: Record<AcademicStatus, "primary" | "success" | "neutral" | "warning"> = {
  enrolled: "success",
  leave: "warning",
  graduated: "neutral",
  completed: "primary",
};

export function MemberRow({
  member,
  organizerTaken,
}: {
  member: Profile;
  organizerTaken: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [role, setRole] = useState(member.role);
  const [position, setPosition] = useState<Position | "">(member.position ?? "");
  const [status, setStatus] = useState(member.status);
  const [academicStatus, setAcademicStatus] = useState(member.academic_status ?? null);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }

  const [name, setName] = useState(member.name);
  const [nickname, setNickname] = useState(member.nickname);
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
        nickname,
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

  const [deleteError, setDeleteError] = useState<string>();
  const [deletePending, startDeleteTransition] = useTransition();

  function handleDelete() {
    // ponytail: 네이티브 confirm() — 이 저장소의 다른 삭제 버튼과 동일한 패턴
    if (
      !confirm(
        `${member.name || "이 회원"}을(를) 완전히 삭제할까요?\n계정과 작성 글·신청·출석 기록이 함께 사라지고 되돌릴 수 없어요.`,
      )
    )
      return;
    setDeleteError(undefined);
    startDeleteTransition(async () => {
      const result = await deleteMember(member.id);
      if (result?.error) setDeleteError(result.error);
      else dialogRef.current?.close();
    });
  }

  function handleRoleChange(e: SelectChangeEvent) {
    const next = e.target.value as Role;
    setRole(next);
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await setMemberRole(member.id, next);
      if (result?.error) {
        setError(result.error);
        setRole(member.role);
      } else flashSaved();
    });
  }

  function handlePositionChange(e: SelectChangeEvent) {
    const next = e.target.value as Position;
    setPosition(next);
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await setMemberPosition(member.id, next);
      if (result?.error) {
        setError(result.error);
        setPosition(member.position ?? "");
      } else flashSaved();
    });
  }

  function handleStatusChange(e: SelectChangeEvent) {
    const next = e.target.value as MemberStatus;
    setStatus(next);
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await setMemberStatus(member.id, next);
      if (result?.error) {
        setError(result.error);
        setStatus(member.status);
      } else flashSaved();
    });
  }

  function handleAcademicStatusChange(e: SelectChangeEvent) {
    const next = (e.target.value || null) as AcademicStatus | null;
    setAcademicStatus(next);
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await setMemberAcademicStatus(member.id, next);
      if (result?.error) {
        setError(result.error);
        setAcademicStatus(member.academic_status ?? null);
      } else flashSaved();
    });
  }

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 last:border-0 transition-colors duration-100 hover:bg-gray-50 active:bg-gray-100"
        onClick={() => dialogRef.current?.showModal()}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar
              name={member.name}
              avatarPath={member.avatar_path}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary"
            />
            <Link
              href={`/admin/members/${member.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-primary hover:underline"
            >
              {member.name || "(이름 없음)"}
            </Link>
          </div>
        </td>
        <td className="px-4 py-4 text-gray-700">{member.nickname || "-"}</td>
        <td className="px-4 py-4 text-gray-700">{member.student_no || "-"}</td>
        <td className="px-4 py-4 text-gray-700">{member.major || "-"}</td>
        <td className="px-4 py-4 text-gray-700">{member.phone || "-"}</td>
        <td className="px-4 py-4">
          <Badge tone={roleTone[role]}>{roleLabel[role]}</Badge>
        </td>
        <td className="px-4 py-4 text-gray-700">
          {position ? POSITION_LABELS[position] : "-"}
        </td>
        <td className="px-4 py-4">
          <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
        </td>
        <td className="px-4 py-4 text-gray-700">
          {academicStatus ? ACADEMIC_STATUS_LABELS[academicStatus] : "-"}
        </td>
        <td className="px-4 py-4 text-gray-500">
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
            className="member-modal fixed top-1/2 left-[calc(50%+7.5rem)] m-0 max-h-[85vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-gray-200 shadow-card"
          >
            <div className="grid flex-1 grid-cols-[3fr_2fr] overflow-y-auto rounded-xl">
              <form
                onSubmit={handleProfileSubmit}
                className="flex flex-col gap-3 p-6"
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
                    label="영어 닉네임"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
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

              <div className="flex flex-col gap-3 bg-gray-50 p-6">
                <p className="text-sm font-semibold text-gray-900">역할 · 상태 · 재학여부</p>
                <div className="flex items-center gap-2">
                  <Badge tone={roleTone[role]}>{roleLabel[role]}</Badge>
                  <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
                  {academicStatus && (
                    <Badge tone={academicStatusTone[academicStatus]}>
                      {ACADEMIC_STATUS_LABELS[academicStatus]}
                    </Badge>
                  )}
                </div>
                <Select
                  label="역할"
                  value={role}
                  onChange={handleRoleChange}
                  disabled={pending}
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
                  value={position}
                  onChange={handlePositionChange}
                  disabled={pending}
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
                  value={status}
                  onChange={handleStatusChange}
                  disabled={pending}
                >
                  <option value="active">활동</option>
                  <option value="dormant">휴면</option>
                  <option value="withdrawn">탈퇴</option>
                </Select>
                <Select
                  label="재학여부"
                  value={academicStatus ?? ""}
                  onChange={handleAcademicStatusChange}
                  disabled={pending}
                >
                  <option value="">선택 안 함</option>
                  <option value="enrolled">재학</option>
                  <option value="leave">휴학</option>
                  <option value="graduated">졸업</option>
                  <option value="completed">수료</option>
                </Select>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>변경 즉시 사이트에 반영돼요.</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-success transition-opacity duration-200",
                      saved ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        d="M5 10l3 3 7-7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    저장했어요
                  </span>
                </div>
                {error && <p className="text-xs text-danger">{error}</p>}

                <div className="mt-auto flex flex-col gap-2 border-t border-gray-200 pt-4">
                  <Button
                    type="button"
                    variant="danger-outline"
                    size="sm"
                    className="self-start"
                    onClick={handleDelete}
                    disabled={deletePending || role === "organizer"}
                  >
                    회원 삭제
                  </Button>
                  <p className="text-xs text-gray-400">
                    계정까지 완전히 삭제돼요. 되돌릴 수 없어요.
                  </p>
                  {deleteError && <p className="text-xs text-danger">{deleteError}</p>}
                </div>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
