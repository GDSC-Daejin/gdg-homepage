import { requireAdmin } from "@/lib/auth";
import { getRecruitingSettings, DEFAULT_SETTINGS } from "@/lib/recruiting";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { isDemoMode } from "@/lib/demo";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const demo = await isDemoMode();

  const settings = demo ? DEFAULT_SETTINGS : await getRecruitingSettings();

  return (
    <div>
      <PageHeader title="설정" description="모집 시즌과 지원 파트를 관리해요" />
      <Card>
        <SettingsForm settings={settings} />
      </Card>
    </div>
  );
}
