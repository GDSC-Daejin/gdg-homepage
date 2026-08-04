import { createClient } from "@/lib/supabase/server";

type TeamMemberRow = {
  id: string;
  nickname: string;
  avatar_path: string | null;
  role: "organizer" | "team_member";
};

export async function loadTeamMembers() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_public")
    .select("id, nickname, avatar_path, role")
    .order("role");
  const members = (data ?? []) as TeamMemberRow[];

  return {
    organizers: members
      .filter((member) => member.role === "organizer")
      .map((member) => ({ id: member.id, nickname: member.nickname, avatarPath: member.avatar_path })),
    teamMembers: members
      .filter((member) => member.role === "team_member")
      .map((member) => ({ id: member.id, nickname: member.nickname, avatarPath: member.avatar_path })),
  };
}
