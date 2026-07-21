"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { postSchema, commentSchema } from "@/lib/schemas";
import { toKoreanError } from "@/lib/errors";
import { ADMIN_ROLES, type ActionResult, type BoardType } from "@/lib/types";

function boardPath(board: BoardType) {
  return board === "qna" ? "/qna" : "/board";
}

function parsePostForm(formData: FormData, board: BoardType) {
  const eventId = String(formData.get("event_id") ?? "").trim();
  return postSchema.safeParse({
    board,
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    event_id: eventId ? eventId : null,
  });
}

export async function createPost(
  board: BoardType,
  formData: FormData,
): Promise<ActionResult & { id?: string }> {
  const profile = await requireProfile();

  const parsed = parsePostForm(formData, board);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({ ...parsed.data, author_id: profile.id })
    .select("id")
    .single();

  if (error) return { error: toKoreanError(error) };

  revalidatePath(boardPath(board));
  return { id: data.id };
}

export async function updatePost(
  id: string,
  board: BoardType,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = parsePostForm(formData, board);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", id)
    .maybeSingle();
  if (!post || post.author_id !== profile.id) return { error: "권한이 없어요" };

  const { error } = await supabase
    .from("posts")
    .update({
      title: parsed.data.title,
      body: parsed.data.body,
      event_id: parsed.data.event_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath(boardPath(board));
  revalidatePath(`${boardPath(board)}/${id}`);
  return {};
}

export async function deletePost(id: string, board: BoardType): Promise<ActionResult> {
  const profile = await requireProfile();

  const supabase = await createClient();
  if (!ADMIN_ROLES.includes(profile.role)) {
    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", id)
      .maybeSingle();
    if (!post || post.author_id !== profile.id) return { error: "권한이 없어요" };
  }

  const { error } = await supabase.from("posts").delete().eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath(boardPath(board));
  return {};
}

export async function createComment(
  postId: string,
  board: BoardType,
  formData: FormData,
): Promise<ActionResult> {
  const profile = await requireProfile();

  const parsed = commentSchema.safeParse({
    body: String(formData.get("body") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: profile.id, body: parsed.data.body });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`${boardPath(board)}/${postId}`);
  return {};
}

export async function deleteComment(
  id: string,
  postId: string,
  board: BoardType,
): Promise<ActionResult> {
  const profile = await requireProfile();

  const supabase = await createClient();
  if (!ADMIN_ROLES.includes(profile.role)) {
    const { data: comment } = await supabase
      .from("comments")
      .select("author_id")
      .eq("id", id)
      .maybeSingle();
    if (!comment || comment.author_id !== profile.id) return { error: "권한이 없어요" };
  }

  const { error } = await supabase.from("comments").delete().eq("id", id);

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`${boardPath(board)}/${postId}`);
  return {};
}

export async function acceptAnswer(
  postId: string,
  commentId: string | null,
): Promise<ActionResult> {
  await requireProfile();

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_answer", {
    p_post_id: postId,
    p_comment_id: commentId,
  });

  if (error) return { error: toKoreanError(error) };

  revalidatePath(`/qna/${postId}`);
  return {};
}
