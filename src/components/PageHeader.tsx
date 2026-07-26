import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    // 좁은 화면에서 나란히 두면 action이 설명을 눌러 어절이 깨진다 — md 미만에선 쌓는다
    <div className="flex flex-col gap-2 pb-6 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {action && <div className="md:shrink-0">{action}</div>}
    </div>
  );
}
