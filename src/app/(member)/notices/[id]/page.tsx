import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { formatKst } from "@/lib/format";
import type { Notice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MemberNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireProfile();
  const { id } = await params;

  const supabase = await createClient();
  const { data: notice } = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .single();

  if (!notice) notFound();
  const n = notice as Notice;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={n.title} />
      <Card className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          {n.published_at ? formatKst(n.published_at) : ""}
        </p>
        <p className="whitespace-pre-wrap text-sm text-gray-700">{n.body}</p>
      </Card>
    </div>
  );
}
