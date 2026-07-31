import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { dayKeyKst, displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { NewPollForm, type StaffOption } from "./NewPollForm";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  await requireAdmin();
  const demo = await isDemoMode();

  // 기본 참여자는 Staff 전원. 원본 시안도 운영 인원이 미리 들어가 있다.
  let staff: StaffOption[] = [];
  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, name, nickname")
      .in("role", ["organizer", "team_member"])
      .order("name");
    staff = ((data ?? []) as { id: string; name: string; nickname: string }[]).map((p) => ({
      id: p.id,
      name: displayName(p.name, p.nickname),
    }));
  }

  const host = (await headers()).get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";

  return (
    <NewPollForm
      today={dayKeyKst(new Date().toISOString())}
      staff={staff}
      inviteToken={randomUUID()}
      inviteOrigin={`${proto}://${host}`}
    />
  );
}
