"use client";

import { useState, useTransition } from "react";
import {
  setMemberRole,
  setMemberPosition,
  setMemberStatus,
  setMemberAcademicStatus,
} from "@/actions/member";
import type {
  AcademicStatus,
  MemberStatus,
  Position,
  Profile,
  Role,
} from "@/lib/types";

export const MEMBER_ROLE_LABELS: Record<Role, string> = {
  organizer: "오거나이저",
  team_member: "팀 멤버",
  member: "회원",
  applicant: "지원자",
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  active: "활동",
  dormant: "휴면",
  withdrawn: "탈퇴",
};

export const MEMBER_STATUS_TONES: Record<MemberStatus, "success" | "neutral" | "danger"> = {
  active: "success",
  dormant: "neutral",
  withdrawn: "danger",
};

export const MEMBER_ROLE_TONES: Record<Role, "primary" | "success" | "neutral" | "warning"> = {
  organizer: "primary",
  team_member: "success",
  member: "neutral",
  applicant: "warning",
};

export const MEMBER_ACADEMIC_STATUS_TONES: Record<
  AcademicStatus,
  "primary" | "success" | "neutral" | "warning"
> = {
  enrolled: "success",
  leave: "warning",
  graduated: "neutral",
  completed: "primary",
};

type MemberAttribute = "role" | "position" | "status" | "academicStatus";

interface MemberAttributes {
  role: Role;
  position: Position | "";
  status: MemberStatus;
  academicStatus: AcademicStatus | null;
}

async function updateMemberAttribute(
  userId: string,
  field: MemberAttribute,
  value: string | null,
) {
  switch (field) {
    case "role":
      return setMemberRole(userId, value as Role);
    case "position":
      return setMemberPosition(userId, value as Position);
    case "status":
      return setMemberStatus(userId, value as MemberStatus);
    case "academicStatus":
      return setMemberAcademicStatus(userId, value as AcademicStatus | null);
  }
}

export function useMemberAttributes(
  userId: string,
  initial: MemberAttributes,
  onSaved?: () => void,
) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function change(field: MemberAttribute, raw: string) {
    const value = field === "academicStatus" ? raw || null : raw;
    setValues((prev) => ({ ...prev, [field]: value }) as MemberAttributes);
    setError(undefined);
    startTransition(async () => {
      const result = await updateMemberAttribute(userId, field, value);
      if (result?.error) {
        setError(result.error);
        setValues((prev) => ({ ...prev, [field]: initial[field] }));
      } else {
        onSaved?.();
      }
    });
  }

  return { values, error, pending, change, clearError: () => setError(undefined) };
}

export function toMemberProfileInput({
  name,
  nickname,
  studentNo,
  major,
  phone,
  interests,
}: {
  name: string;
  nickname: string;
  studentNo: string;
  major: string;
  phone: string;
  interests: string;
}): Pick<Profile, "name" | "nickname" | "student_no" | "major" | "phone" | "interests"> {
  return {
    name,
    nickname,
    student_no: studentNo,
    major,
    phone,
    interests: interests.split(",").map((value) => value.trim()).filter(Boolean),
  };
}
