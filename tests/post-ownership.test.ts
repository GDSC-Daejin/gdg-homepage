import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePost } from "@/actions/post";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

describe("updatePost", () => {
  it("다른 회원의 글 수정은 앱 레이어에서 차단한다", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const posts = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { author_id: "other-member" },
            error: null,
          }),
        }),
      }),
      update,
    };

    vi.mocked(requireProfile).mockResolvedValue({
      id: "current-member",
      role: "member",
    } as never);
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn().mockReturnValue(posts),
    } as never);

    const formData = new FormData();
    formData.set("title", "수정 제목");
    formData.set("body", "수정 내용");

    await expect(updatePost("post-id", "free", formData)).resolves.toEqual({
      error: "권한이 없어요",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
