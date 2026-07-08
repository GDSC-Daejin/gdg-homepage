import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_SEASON } from "@/lib/constants";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import type { Application, ApplicationStatus } from "@/lib/types";
import { ApplyForm } from "./ApplyForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: "심사 중",
  accepted: "합격",
  rejected: "불합격",
};

const STATUS_TONE: Record<ApplicationStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  accepted: "success",
  rejected: "danger",
};

export default async function ApplyPage() {
  const profile = await requireProfile();

  if (profile.role !== "applicant") {
    return (
      <div>
        <PageHeader title="지원서" />
        <Card>
          <p className="text-sm text-gray-700">이미 회원입니다.</p>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("*")
    .eq("applicant_id", profile.id)
    .eq("season", CURRENT_SEASON)
    .maybeSingle();
  const application = data as Application | null;

  return (
    <div>
      <PageHeader title="지원서" description={`${CURRENT_SEASON} 시즌 지원`} />
      <Card>
        {application ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">지원 상태</span>
            <Badge tone={STATUS_TONE[application.status]}>
              {STATUS_LABEL[application.status]}
            </Badge>
          </div>
        ) : (
          <ApplyForm />
        )}
      </Card>
    </div>
  );
}
