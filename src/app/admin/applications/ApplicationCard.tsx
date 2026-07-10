"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ReviewButtons } from "./ReviewButtons";
import type { Application, ApplicationStatus } from "@/lib/types";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "심사 중",
  accepted: "합격",
  rejected: "불합격",
};

const STATUS_TONE: Record<ApplicationStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  accepted: "success",
  rejected: "danger",
};

const STATUS_ICON: Record<ApplicationStatus, React.ReactNode> = {
  pending: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
      <path d="M10 2.5c.3 2.6 1.4 3.7 4 4-2.6.3-3.7 1.4-4 4-.3-2.6-1.4-3.7-4-4 2.6-.3 3.7-1.4 4-4Z" />
    </svg>
  ),
  accepted: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="m7 10 2 2 4-4" />
    </svg>
  ),
  rejected: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M8 8l4 4M12 8l-4 4" />
    </svg>
  ),
};

type ApplicantInfo = {
  name: string;
  student_no: string | null;
  major: string | null;
};

export function ApplicationCard({
  application,
  applicant,
}: {
  application: Application;
  applicant: ApplicantInfo | undefined;
}) {
  const [expanded, setExpanded] = useState(false);

  const name = applicant?.name ?? "알 수 없음";
  const studentNo = applicant?.student_no ?? "정보 없음";
  const major = applicant?.major ?? "정보 없음";
  const initial = applicant?.name ? applicant.name.charAt(0) : "?";
  const isUnknown = !applicant?.name;

  const toggleButton = (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover"
    >
      {expanded ? "접기" : "답변 전체 보기"}
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
      >
        <path d="M6 8l4 4 4-4" />
      </svg>
    </button>
  );

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
            isUnknown ? "bg-gray-100 text-gray-400" : "bg-primary-soft text-primary"
          }`}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-gray-900">
              {name}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {isUnknown ? "프로필 정보 없음" : `${studentNo} · ${major}`}
              </span>
            </p>
            <Badge tone={STATUS_TONE[application.status]} className="mt-0.5 shrink-0 gap-1">
              {STATUS_ICON[application.status]}
              {STATUS_LABEL[application.status]}
            </Badge>
          </div>

          {expanded ? (
            <>
              <dl className="mt-4 flex flex-col gap-3">
                <div>
                  <dt className="text-xs font-medium text-gray-500">자기소개</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    {application.answers.intro}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">지원 동기</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    {application.answers.motivation}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">관심 분야</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    {application.answers.interest}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between gap-4">
                {toggleButton}
                <ReviewButtons
                  id={application.id}
                  status={application.status}
                  applicant={{ name, student_no: applicant?.student_no ?? null, major: applicant?.major ?? null }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 flex gap-3">
                <span className="shrink-0 pt-0.5 text-xs text-gray-400">자기소개</span>
                <p className="line-clamp-2 text-sm text-gray-600">
                  {application.answers.intro}
                </p>
              </div>
              <div className="mt-3 flex justify-end">{toggleButton}</div>
            </>
          )}

          {isUnknown && (
            <p className="mt-3 flex items-start gap-1.5 rounded-md bg-gray-50 px-2.5 py-2 text-xs text-gray-500">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-px h-3.5 w-3.5 shrink-0"
              >
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 13.5v-4M10 6.5h.01" />
              </svg>
              회원 프로필이 연결되지 않아 이름 표시만 가능해요. 답변만 확인해 심사할 수 있어요.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
