import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAllApplicationQuestions } from "@/lib/application-questions";
import { getAllInterviewQuestions } from "@/lib/interview-questions";
import { isDemoMode } from "@/lib/demo";
import type { ApplicationQuestionPreset } from "@/lib/types";
import { QuestionsManager } from "./QuestionsManager";

export const dynamic = "force-dynamic";

export default async function AdminQuestionsPage() {
  await requireAdmin();
  const [applicationQuestions, interviewQuestions] = await Promise.all([
    getAllApplicationQuestions(),
    getAllInterviewQuestions(),
  ]);
  let presets: ApplicationQuestionPreset[] = [];

  if (!(await isDemoMode())) {
    const { data } = await (await createClient())
      .from("application_question_presets")
      .select("*")
      .order("created_at", { ascending: false });
    presets = (data as ApplicationQuestionPreset[] | null) ?? [];
  }

  return (
    <QuestionsManager
      applicationQuestions={applicationQuestions}
      interviewQuestions={interviewQuestions}
      presets={presets}
    />
  );
}
