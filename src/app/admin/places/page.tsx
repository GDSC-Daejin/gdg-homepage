import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo";
import { PageHeader } from "@/components/PageHeader";
import { PlaceManager } from "./PlaceManager";
import type { Place } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPlacesPage() {
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
      <PageHeader
        title="장소"
        description="정기세션 등 이벤트가 열리는 장소를 등록해두고 재사용해요"
      />
      <PlaceManager places={places} />
    </div>
  );
}
