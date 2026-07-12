import { PostDetailPage } from "@/components/board/PostDetailPage";

export const dynamic = "force-dynamic";

export default async function QnaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetailPage board="qna" id={id} title="질문답변" />;
}
