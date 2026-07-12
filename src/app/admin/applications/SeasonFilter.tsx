"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/Select";

export function SeasonFilter({
  seasons,
  value,
  status,
  position,
  q,
}: {
  seasons: string[];
  value: string;
  status: string;
  position: string;
  q?: string;
}) {
  const router = useRouter();

  function go(season: string) {
    const params = new URLSearchParams();
    params.set("season", season);
    params.set("status", status);
    if (position !== "all") params.set("position", position);
    if (q) params.set("q", q);
    router.push(`/admin/applications?${params.toString()}`);
  }

  return (
    <Select value={value} onChange={(e) => go(e.target.value)} className="w-40">
      {seasons.map((season) => (
        <option key={season} value={season}>
          {season}
        </option>
      ))}
    </Select>
  );
}
