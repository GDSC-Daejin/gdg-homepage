import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo";
import { dayKeyKst, displayName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { listPlaces } from "@/lib/places";
import { NewPollForm, type MemberOption } from "./NewPollForm";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  await requireAdmin();
  const demo = await isDemoMode();
  const places = await listPlaces();

  let members: MemberOption[] = [];
  if (!demo) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, name, nickname, avatar_path")
      .in("role", ["organizer", "team_member", "member"])
      .eq("status", "active")
      .not("approved_at", "is", null)
      .order("name");
    members = ((data ?? []) as { id: string; name: string; nickname: string; avatar_path: string | null }[]).map((p) => ({
      id: p.id,
      name: displayName(p.name, p.nickname),
      avatarPath: p.avatar_path,
    }));
  }

  return (
    <NewPollForm
      today={dayKeyKst(new Date().toISOString())}
      members={members}
      inviteToken={randomUUID()}
      places={places}
    />
  );
}
