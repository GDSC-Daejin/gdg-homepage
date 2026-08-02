import { PostListPage } from "@/components/board/PostListPage";
import { CommunityTabs } from "@/components/board/CommunityTabs";

export const dynamic = "force-dynamic";

export default function BoardPage() {
  return (
    <div className="flex flex-col gap-6">
      <CommunityTabs />
      <PostListPage board="free" title="자유게시판" description="자유롭게 이야기를 나눠보세요" />
    </div>
  );
}
