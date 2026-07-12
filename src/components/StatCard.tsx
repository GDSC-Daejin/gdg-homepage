import { ReactNode } from "react";
import { Card } from "@/components/Card";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  emphasis?: boolean;
}

export function StatCard({ label, value, hint, emphasis }: StatCardProps) {
  if (emphasis) {
    return (
      <Card className="border-transparent bg-primary">
        <p className="text-sm text-white/80">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
        {hint && <p className="mt-1 text-xs text-white/70">{hint}</p>}
      </Card>
    );
  }
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </Card>
  );
}
