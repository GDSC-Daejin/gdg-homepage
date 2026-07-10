"use client";

import { useState, useTransition } from "react";
import { deleteSponsor } from "@/actions/budget";
import { Button } from "@/components/Button";

export function DeleteSponsorButton({ id }: { id: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("스폰서를 삭제할까요? 되돌릴 수 없어요.")) return;

    setError(undefined);
    startTransition(async () => {
      const result = await deleteSponsor(id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        size="sm"
        onClick={handleDelete}
        disabled={pending}
      >
        삭제
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
