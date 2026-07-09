import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { NoticeForm } from "../NoticeForm";

export const dynamic = "force-dynamic";

export default function NewNoticePage() {
  return (
    <div>
      <PageHeader title="공지 작성" />
      <Card>
        <NoticeForm />
      </Card>
    </div>
  );
}
