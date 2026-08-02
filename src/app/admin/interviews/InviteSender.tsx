"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInvites } from "@/actions/interview";
import { Button } from "@/components/Button";

interface ApplicationOption {
  id: string;
  applicant_name: string;
  email: string;
}

export function InviteSender({ applications }: { applications: ApplicationOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function submit() {
    setMessage(undefined);
    startTransition(async () => {
      const result = await sendInvites(selected);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setSelected([]);
      setMessage("면접 예약 링크를 발송했어요.");
      router.refresh();
    });
  }

  if (applications.length === 0) {
    return <p className="text-sm text-gray-500">초대할 서류 통과자가 없어요.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-52 divide-y overflow-y-auto rounded-lg border border-gray-200">
        {applications.map((application) => (
          <label key={application.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(application.id)}
              onChange={() => toggle(application.id)}
              className="h-4 w-4 accent-primary"
            />
            <span className="font-medium text-gray-900">{application.applicant_name}</span>
            <span className="text-gray-500">{application.email}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="primary" disabled={selected.length === 0 || pending} onClick={submit}>
          {pending ? "발송 중..." : "면접 링크 보내기"}
        </Button>
        {message && <p className={`text-xs ${message.includes("실패") || message.includes("선택") ? "text-danger" : "text-success"}`}>{message}</p>}
      </div>
    </div>
  );
}
