import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white py-16 text-center shadow-card dark:bg-gray-100">
      {icon && (
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-200 text-gray-400">
          {icon}
        </div>
      )}
      <p className="text-base font-bold text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
