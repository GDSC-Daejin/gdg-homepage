import { PostListPage } from "@/components/board/PostListPage";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  return <PostListPage board="free" title="자유게시판" description="자유롭게 이야기를 나눠보세요" />;
}
