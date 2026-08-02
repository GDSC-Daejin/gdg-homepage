import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SurveyForm } from "../../SurveyForm";
import type { Event, Survey, SurveyPreset } from "@/lib/types";
import { isDemoMode } from "@/lib/demo";
import {
  DEMO_SURVEYS,
  DEMO_SURVEY_EVENT_OPTIONS,
  DEMO_SURVEY_PRESETS,
} from "@/lib/demoData";

export const dynamic = "force-dynamic";

export default async function EditSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = await isDemoMode();

  let events: Pick<Event, "id" | "title">[] = DEMO_SURVEY_EVENT_OPTIONS;
  let presets: SurveyPreset[] = DEMO_SURVEY_PRESETS;
  let survey: Survey | undefined = DEMO_SURVEYS.find((s) => s.id === id);

  if (!demo) {
    const supabase = await createClient();
    const [{ data: surveyData }, { data: eventData }, { data: presetData }] =
      await Promise.all([
        supabase.from("surveys").select("*").eq("id", id).single(),
        supabase
          .from("events")
          .select("id, title")
          .order("starts_at", { ascending: false }),
        supabase
          .from("survey_presets")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
    survey = (surveyData as Survey) ?? undefined;
    events = (eventData ?? []) as Pick<Event, "id" | "title">[];
    presets = (presetData ?? []) as SurveyPreset[];
  }

  if (!survey) notFound();

  return (
    <div>
      <nav className="mb-2 flex items-center gap-1 text-xs text-gray-400">
        <Link href="/admin/surveys" className="hover:text-gray-600">
          설문
        </Link>
        <span>›</span>
        <span className="text-gray-500">설문 수정</span>
      </nav>
      <PageHeader title="설문 수정" />
      <Card>
        <SurveyForm events={events} presets={presets} survey={survey} />
      </Card>
    </div>
  );
}
