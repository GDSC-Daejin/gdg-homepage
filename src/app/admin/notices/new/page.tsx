import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { NoticeForm } from "../NoticeForm";

export const dynamic = "force-dynamic";

export default function NewNoticePage() {
  return (
    <div>
      <PageHeader
        title="공지 작성"
        description={
          <>
            작성한 공지는 <strong className="font-semibold">미발행</strong> 상태로 저장돼요.
            발행은 목록에서 공지를 열어 진행해요.
          </>
        }
      />
      <Card>
        <NoticeForm />
      </Card>
    </div>
  );
}
