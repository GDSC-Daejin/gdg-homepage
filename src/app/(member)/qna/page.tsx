import { PostListPage } from "@/components/board/PostListPage";
import { CommunityTabs } from "@/components/board/CommunityTabs";

export const dynamic = "force-dynamic";

export default function QnaPage() {
  return (
    <div className="flex flex-col gap-6">
      <CommunityTabs />
      <PostListPage board="qna" title="질문답변" description="궁금한 걸 묻고 답해보세요" />
    </div>
  );
}
