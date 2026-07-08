interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  );
}
