import { requireProfile } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function MemberHomePage() {
  await requireProfile();

  return <EmptyState title="이벤트 목록은 준비 중" />;
}
