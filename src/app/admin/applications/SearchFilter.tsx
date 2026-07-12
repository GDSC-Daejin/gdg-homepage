"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function SearchFilter({
  season,
  status,
  position,
  q,
}: {
  season: string;
  status: string;
  position: string;
  q?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("season", season);
    params.set("status", status);
    if (position !== "all") params.set("position", position);
    if (value.trim()) params.set("q", value.trim());
    router.push(`/admin/applications?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        placeholder="이름 또는 학번 검색"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-48"
      />
      <Button type="submit" variant="secondary" size="sm">
        검색
      </Button>
    </form>
  );
}
