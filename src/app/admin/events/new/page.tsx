import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { EventForm } from "../EventForm";

export const dynamic = "force-dynamic";

export default function NewEventPage() {
  return (
    <div>
      <PageHeader title="이벤트 생성" />
      <Card>
        <EventForm />
      </Card>
    </div>
  );
}
