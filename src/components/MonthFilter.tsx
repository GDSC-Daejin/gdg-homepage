"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/Select";

interface MonthFilterProps {
  options: { value: string; label: string }[];
  value: string;
  basePath: string;
}

export function MonthFilter({ options, value, basePath }: MonthFilterProps) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onChange={(e) =>
        router.push(
          e.target.value ? `${basePath}?month=${e.target.value}` : basePath,
        )
      }
      className="w-40"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}
