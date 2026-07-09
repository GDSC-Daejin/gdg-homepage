import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SurveyForm } from "../SurveyForm";
import type { Event } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewSurveyPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, title")
    .order("starts_at", { ascending: false });

  return (
    <div>
      <PageHeader title="설문 생성" />
      <Card>
        <SurveyForm events={(events ?? []) as Pick<Event, "id" | "title">[]} />
      </Card>
    </div>
  );
}
