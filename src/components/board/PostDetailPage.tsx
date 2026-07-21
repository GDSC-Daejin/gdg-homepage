import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { PostDetailBody } from "@/components/board/PostDetailBody";
import { DeletePostButton } from "@/components/board/DeletePostButton";
import { DeleteCommentButton } from "@/components/board/DeleteCommentButton";
import { CommentForm } from "@/components/board/CommentForm";
import { AcceptButton } from "@/components/board/AcceptButton";
import { formatKst } from "@/lib/format";
import { isStaff, type BoardType } from "@/lib/types";

interface PostRow {
  id: string;
  board: BoardType;
  title: string;
  body: string;
  author_id: string;
  event_id: string | null;
  accepted_comment_id: string | null;
  created_at: string;
  member_public: { name: string } | null;
}

interface CommentRow {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  member_public: { name: string } | null;
}

export async function PostDetailPage({
  board,
  id,
  title,
}: {
  board: BoardType;
  id: string;
  title: string;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const basePath = board === "qna" ? "/qna" : "/board";

  const [{ data: postRow }, { data: commentRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, board, title, body, author_id, event_id, accepted_comment_id, created_at, member_public(name)",
      )
      .eq("id", id)
      .eq("board", board)
      .single(),
    supabase
      .from("comments")
      .select("id, author_id, body, created_at, member_public(name)")
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("events").select("id, title").order("starts_at", { ascending: false }).limit(30),
  ]);

  if (!postRow) notFound();
  const post = postRow as unknown as PostRow;
  const comments = (commentRows as unknown as CommentRow[] | null) ?? [];
  const eventOptions = eventRows ?? [];

  const isOwner = post.author_id === profile.id;
  const canDelete = isOwner || isStaff(profile);
  const linkedEvent = eventOptions.find((e) => e.id === post.event_id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        action={
          <Link href={basePath} className="text-sm text-gray-500 hover:text-gray-700">
            목록으로
          </Link>
        }
      />

      <Card className="flex flex-col gap-4">
        {linkedEvent && (
          <Link href={`/events/${linkedEvent.id}`}>
            <Badge tone="primary">{linkedEvent.title}</Badge>
          </Link>
        )}
        <PostDetailBody
          board={board}
          post={{ id: post.id, title: post.title, body: post.body, event_id: post.event_id }}
          eventOptions={eventOptions}
          canEdit={isOwner}
        />
        <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
          <span className="min-w-0 truncate">
            {post.member_public?.name ?? "탈퇴한 회원"} · {formatKst(post.created_at)}
          </span>
          {canDelete && <DeletePostButton id={post.id} board={board} />}
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-gray-900">댓글 {comments.length}</p>
        {comments.map((comment) => {
          const accepted = post.accepted_comment_id === comment.id;
          return (
            <Card key={comment.id} className={accepted ? "border-success" : undefined}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  {accepted && <Badge tone="success">채택된 답변</Badge>}
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
                  <p className="text-xs text-gray-500">
                    {comment.member_public?.name ?? "탈퇴한 회원"} · {formatKst(comment.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {board === "qna" && isOwner && (
                    <AcceptButton postId={post.id} commentId={comment.id} accepted={accepted} />
                  )}
                  {(comment.author_id === profile.id || isStaff(profile)) && (
                    <DeleteCommentButton id={comment.id} postId={post.id} board={board} />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        <Card>
          <CommentForm postId={post.id} board={board} />
        </Card>
      </div>
    </div>
  );
}
