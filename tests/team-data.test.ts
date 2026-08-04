import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient }));

describe("loadTeamMembers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("공개 팀 목록을 오거나이저와 팀 멤버로 분리한다", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: "organizer-1", nickname: "Jaden", avatar_path: "avatars/jaden.png", role: "organizer" },
        { id: "member-1", nickname: "Mina", avatar_path: null, role: "team_member" },
      ],
    });
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order }) }),
    });

    const { loadTeamMembers } = await import("@/app/team/team-data");

    await expect(loadTeamMembers()).resolves.toEqual({
      organizers: [{ id: "organizer-1", nickname: "Jaden", avatarPath: "avatars/jaden.png" }],
      teamMembers: [{ id: "member-1", nickname: "Mina", avatarPath: null }],
    });
  });
});
