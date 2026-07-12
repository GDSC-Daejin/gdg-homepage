import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { PostForm } from "@/components/board/PostForm";
import { formatKst } from "@/lib/format";
import type { BoardType } from "@/lib/types";

interface PostRow {
  id: string;
  title: string;
  accepted_comment_id: string | null;
  created_at: string;
  profiles: { name: string } | null;
}

export async function PostListPage({
  board,
  title,
  description,
}: {
  board: BoardType;
  title: string;
  description: string;
}) {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: postRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, accepted_comment_id, created_at, profiles(name)")
      .eq("board", board)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("events").select("id, title").order("starts_at", { ascending: false }).limit(30),
  ]);

  const posts = (postRows as unknown as PostRow[] | null) ?? [];
  const eventOptions = eventRows ?? [];
  const basePath = board === "qna" ? "/qna" : "/board";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />

      <Card>
        <PostForm board={board} eventOptions={eventOptions} />
      </Card>

      {posts.length === 0 ? (
        <EmptyState title="아직 글이 없어요" description="첫 글을 남겨보세요" />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Link key={post.id} href={`${basePath}/${post.id}`}>
              <Card className="flex items-center justify-between gap-4 transition-colors hover:border-primary">
                <div className="flex items-center gap-2">
                  {board === "qna" && (
                    <Badge tone={post.accepted_comment_id ? "success" : "neutral"}>
                      {post.accepted_comment_id ? "해결됨" : "미해결"}
                    </Badge>
                  )}
                  <p className="font-semibold text-gray-900">{post.title}</p>
                </div>
                <p className="shrink-0 text-xs text-gray-500">
                  {post.profiles?.name ?? "탈퇴한 회원"} · {formatKst(post.created_at)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
