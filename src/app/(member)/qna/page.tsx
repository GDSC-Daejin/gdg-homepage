import { PostListPage } from "@/components/board/PostListPage";

export const dynamic = "force-dynamic";

export default function QnaPage() {
  return <PostListPage board="qna" title="질문답변" description="궁금한 걸 묻고 답해보세요" />;
}
