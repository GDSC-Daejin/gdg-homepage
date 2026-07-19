import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import type { Place } from "@/lib/types";
import { EventForm } from "../EventForm";

export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  let places: Place[] = [];
  if (!(await isDemoMode())) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("places")
      .select("*")
      .order("name", { ascending: true });
    places = (data ?? []) as Place[];
  }

  return (
    <div>
      <PageHeader title="이벤트 생성" />
      <Card>
        <EventForm places={places} />
      </Card>
    </div>
  );
}
