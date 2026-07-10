import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SurveyForm } from "../SurveyForm";
import type { Event } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import { DEMO_SURVEY_EVENT_OPTIONS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function NewSurveyPage() {
  const demo = await isDemoMode();
  let events: Pick<Event, "id" | "title">[] = DEMO_SURVEY_EVENT_OPTIONS;

  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("id, title")
      .order("starts_at", { ascending: false });
    events = (data ?? []) as Pick<Event, "id" | "title">[];
  }

  return (
    <div>
      <nav className="mb-2 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/admin/surveys" className="hover:text-gray-600">
          설문
        </Link>
        <span>›</span>
        <span className="text-gray-500">새 설문</span>
      </nav>
      <PageHeader title="설문 생성" />
      <Card>
        <SurveyForm events={events} />
      </Card>
    </div>
  );
}
