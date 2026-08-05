import Link from "next/link";
import { cn } from "@/lib/cn";

export function EventStatusToggle({ basePath, past, month }: { basePath: string; past: boolean; month?: string }) {
  const href = (status?: "past") => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (status) params.set("status", status);
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };
  const base = "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-100";

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-300 p-0.5" role="group" aria-label="일정 상태">
      <Link href={href()} aria-current={past ? undefined : "page"} className={cn(base, past ? "text-gray-600 hover:bg-gray-100" : "bg-primary-soft text-primary")}>
        예정/진행
      </Link>
      <Link href={href("past")} aria-current={past ? "page" : undefined} className={cn(base, past ? "bg-primary-soft text-primary" : "text-gray-600 hover:bg-gray-100")}>
        지난 일정
      </Link>
    </div>
  );
}
