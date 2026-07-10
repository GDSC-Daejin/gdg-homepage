"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/Select";

export function SeasonFilter({
  seasons,
  value,
  status,
}: {
  seasons: string[];
  value: string;
  status: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onChange={(e) =>
        router.push(`/admin/applications?season=${e.target.value}&status=${status}`)
      }
      className="w-40"
    >
      {seasons.map((season) => (
        <option key={season} value={season}>
          {season}
        </option>
      ))}
    </Select>
  );
}
