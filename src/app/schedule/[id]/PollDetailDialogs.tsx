"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/wds/Button";
import { SelectBox } from "@/components/wds/primitives";
import {
  dateWithWeekday,
  durationLabel,
  DURATION_OPTIONS,
  timeAmPm,
} from "@/lib/meeting-poll";
import { kstDayKey, kstTime } from "./poll-detail-time";

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.44)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 380,
          background: "var(--wds-bg-elevated)",
          borderRadius: 16,
          boxShadow: "var(--wds-shadow-heavy)",
          padding: "24px 24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontFamily: "var(--wds-font-sans)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function NudgeDialog({
  count,
  busy,
  onClose,
  onSubmit,
}: {
  count: number;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ font: "700 18px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
          {count}명에게 알림을 보낼까요?
        </span>
        <span style={{ font: "400 14px/1.5 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
          아직 응답하지 않은 {count}명에게 Slack 개인 DM으로 알림이 발송돼요.
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
        <Button variant="text" color="assistive" size="medium" onClick={onClose}>
          취소
        </Button>
        <Button variant="solid" color="primary" size="medium" disabled={busy} onClick={onSubmit}>
          보내기
        </Button>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  startIso,
  durationMin,
  timeOptions,
  busy,
  onStart,
  onDuration,
  onClose,
  onSubmit,
}: {
  startIso: string;
  durationMin: number;
  timeOptions?: { value: string; label: string }[];
  busy: boolean;
  onStart?: (startIso: string) => void;
  onDuration: (min: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ font: "700 18px/1.4 var(--wds-font-sans)", color: "var(--wds-label-normal)" }}>
          이 시간으로 확정할까요?
        </span>
        <span style={{ font: "400 14px/1.5 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
          {dateWithWeekday(kstDayKey(startIso))} {timeAmPm(kstTime(startIso))}
        </span>
      </div>
      {timeOptions && onStart && (
        <SelectBox
          label="시작 시간"
          value={startIso}
          options={timeOptions}
          onChange={onStart}
        />
      )}
      <SelectBox
        label="소요 시간"
        value={String(durationMin)}
        options={DURATION_OPTIONS.map((min) => ({ value: String(min), label: durationLabel(min) }))}
        onChange={(value) => onDuration(Number(value))}
      />
      <span style={{ font: "400 13px/1.5 var(--wds-font-sans)", color: "var(--wds-label-alternative)" }}>
        확정하면 응답이 잠기고 이벤트 달력에 표시돼요.
      </span>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 2 }}>
        <Button variant="text" color="assistive" size="medium" onClick={onClose}>
          취소
        </Button>
        <Button variant="solid" color="primary" size="medium" disabled={busy} onClick={onSubmit}>
          확정
        </Button>
      </div>
    </Modal>
  );
}
