import { requireAdmin } from "@/lib/auth";
import { getAllInterviewQuestions } from "@/lib/interview-questions";
import { InterviewQuestionManager } from "./InterviewQuestionManager";

export const dynamic = "force-dynamic";

export default async function AdminInterviewQuestionsPage() {
  await requireAdmin();
  const questions = await getAllInterviewQuestions();
  return <InterviewQuestionManager questions={questions} />;
}
