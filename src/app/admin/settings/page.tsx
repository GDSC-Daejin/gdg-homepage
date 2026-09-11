import { requireAdmin } from "@/lib/auth";
import { getRecruitingSettings } from "@/lib/recruiting";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs, SYSTEM_TABS } from "../SectionTabs";
import { Card } from "@/components/Card";
import { isDemoMode } from "@/lib/demo";
import { DEMO_RECRUITING_SETTINGS } from "@/lib/demoData";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const demo = await isDemoMode();

  const settings = demo ? DEMO_RECRUITING_SETTINGS : await getRecruitingSettings();

  return (
    <div>
      <SectionTabs tabs={SYSTEM_TABS} label="시스템" />
      <PageHeader title="모집 설정" description="모집 시즌과 지원 파트를 관리해요" />
      <Card>
        <SettingsForm settings={settings} />
      </Card>
    </div>
  );
}
