import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAllApplicationQuestions } from "@/lib/application-questions";
import { isDemoMode } from "@/lib/demo";
import { ApplicationQuestionManager } from "./ApplicationQuestionManager";
import type { ApplicationQuestionPreset } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminApplicationQuestionsPage() {
  await requireAdmin();
  const questions = await getAllApplicationQuestions();
  let presets: ApplicationQuestionPreset[] = [];
  if (!(await isDemoMode())) {
    const { data } = await (await createClient()).from("application_question_presets").select("*").order("created_at", { ascending: false });
    presets = (data as ApplicationQuestionPreset[] | null) ?? [];
  }
  return <ApplicationQuestionManager questions={questions} presets={presets} />;
}
