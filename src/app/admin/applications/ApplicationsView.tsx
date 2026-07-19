"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import type { Application, ApplicationStatus } from "@/lib/types";
import { ApplicationCard } from "./ApplicationCard";
import { SeasonFilter } from "./SeasonFilter";
import { StatCard } from "./StatCard";

const STAT_CARDS: {
  value: "all" | ApplicationStatus;
  label: string;
  tone: "neutral" | "warning" | "primary" | "success" | "danger";
}[] = [
  { value: "all", label: "전체", tone: "neutral" },
  { value: "waiting", label: "심사 대기", tone: "warning" },
  { value: "pending", label: "심사 중", tone: "primary" },
  { value: "accepted", label: "합격", tone: "success" },
  { value: "rejected", label: "불합격", tone: "danger" },
];

const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "전체 직군" },
  { value: "frontend", label: "프론트엔드" },
  { value: "backend", label: "백엔드" },
  { value: "designer", label: "디자이너" },
  { value: "beginner", label: "비기너" },
  { value: "none", label: "미지정" },
];

export function ApplicationsView({
  applications,
  seasons,
  season,
}: {
  applications: Application[];
  seasons: string[];
  season: string;
}) {
  const [status, setStatus] = useState<"all" | ApplicationStatus>("all");
  const [position, setPosition] = useState("all");
  const [q, setQ] = useState("");

  const statusCounts = useMemo<Record<"all" | ApplicationStatus, number>>(
    () => ({
      all: applications.length,
      waiting: applications.filter((a) => a.status === "waiting").length,
      pending: applications.filter((a) => a.status === "pending").length,
      accepted: applications.filter((a) => a.status === "accepted").length,
      rejected: applications.filter((a) => a.status === "rejected").length,
    }),
    [applications],
  );

  const reviewed = statusCounts.accepted + statusCounts.rejected;
  const acceptRate = reviewed > 0 ? Math.round((statusCounts.accepted / reviewed) * 100) : 0;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return applications.filter((a) => {
      if (status !== "all" && a.status !== status) return false;
      if (position !== "all") {
        if (position === "none" ? a.position !== null : a.position !== position) return false;
      }
      if (query) {
        return (
          a.applicant_name.toLowerCase().includes(query) ||
          a.student_no.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [applications, status, position, q]);

  const isDecidedView = status === "accepted" || status === "rejected";

  return (
    <div>
      <PageHeader
        title="지원서 심사"
        description={`${season} 리크루팅 · 지원자의 답변을 읽고 합격/불합격을 결정해요`}
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-500">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <circle cx="10" cy="10" r="7.5" />
              <circle cx="10" cy="10" r="2.5" />
            </svg>
            GDG DJU 운영진 · 시즌별 지원서 심사
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.value}
            label={card.label}
            value={statusCounts[card.value]}
            tone={card.tone}
            active={status === card.value}
            onClick={() => setStatus(card.value)}
          />
        ))}
        <div className="rounded-xl border border-gray-200 bg-white dark:bg-gray-100 p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-gray-500">합격률</p>
            <p className="text-2xl font-bold text-success">{acceptRate}%</p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200">
            <div
              className="h-full rounded-full bg-success"
              style={{ width: `${acceptRate}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            심사 완료 {reviewed} / {statusCounts.all}명
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-36"
        >
          {POSITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <div className="flex-1">
          <Input
            placeholder="이름 또는 학번 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full"
          />
        </div>
        <SeasonFilter seasons={seasons} value={season} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="지원서가 없어요"
          description="선택한 조건에 해당하는 지원서가 없어요. 다른 상태 탭이나 시즌을 확인해 보세요."
          icon={
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M3.5 6.5 10 3l6.5 3.5v9L10 19l-6.5-3.5v-9Z" />
              <path d="M3.5 6.5 10 10l6.5-3.5M10 10v9" />
            </svg>
          }
        />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((app) => (
              <ApplicationCard key={app.id} application={app} />
            ))}
          </div>
          {isDecidedView && (
            <p className="mt-4 text-sm text-gray-500">
              한 번 심사한 지원서는 다시 심사할 수 없어요
            </p>
          )}
        </div>
      )}
    </div>
  );
}
