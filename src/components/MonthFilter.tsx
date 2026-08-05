"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/Select";

interface MonthFilterProps {
  options: { value: string; label: string }[];
  value: string;
  basePath: string;
  query?: Record<string, string>;
}

export function MonthFilter({ options, value, basePath, query }: MonthFilterProps) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams(query);
        if (e.target.value) params.set("month", e.target.value);
        else params.delete("month");
        const search = params.toString();
        router.push(`${basePath}${search ? `?${search}` : ""}`);
      }}
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
