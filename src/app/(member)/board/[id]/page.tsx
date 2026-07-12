import { PostDetailPage } from "@/components/board/PostDetailPage";

export const dynamic = "force-dynamic";

export default async function BoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetailPage board="free" id={id} title="자유게시판" />;
}
