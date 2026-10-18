import { PageHeader } from "@/components/PageHeader";
import { NoticeForm } from "../NoticeForm";
import type { NoticeSource } from "../NoticeSourcePicker";
import { listPlaces } from "@/lib/places";
import { listNoticeTemplates } from "@/lib/notice-templates";
import { getCommunity } from "@/lib/community";
import { formatKstDate } from "@/lib/format";
import { parseNoticeBody, suggestSupplies } from "@/lib/notice-body";

export const dynamic = "force-dynamic";

const RECENT_LIMIT = 3;
const DEFAULT_SUPPLIES = ["노트북", "충전기", "필기도구", "학생증"];

function summarize(body: string): string {
  const { place, supplies, body: text } = parseNoticeBody(body);
  const head = [place, supplies].filter(Boolean).join(" · ");
  return head || text.split("\n")[0] || "본문 없음";
}

export default async function NewNoticePage() {
  const community = await getCommunity();
  const [places, notices, templates] = await Promise.all([
    listPlaces(),
    community.notices.reads.list(),
    listNoticeTemplates(),
  ]);

  const sources: NoticeSource[] = [
    ...notices.slice(0, RECENT_LIMIT).map((n) => ({
      id: n.id,
      kind: "recent" as const,
      label: n.title,
      meta: [
        n.published_at ? `${formatKstDate(n.published_at)} 발행` : `${formatKstDate(n.created_at)} 작성 · 미발행`,
        summarize(n.body),
      ].join(" · "),
      title: n.title,
      body: n.body,
    })),
    ...templates.map((t) => ({
      id: t.id,
      kind: "template" as const,
      label: t.name,
      meta: [`템플릿 · ${formatKstDate(t.created_at)} 저장`, summarize(t.body)].join(" · "),
      title: t.title,
      body: t.body,
    })),
  ];
  const supplySuggestions = suggestSupplies(
    notices.map((n) => n.body),
    DEFAULT_SUPPLIES,
  );

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
      <NoticeForm places={places} sources={sources} supplySuggestions={supplySuggestions} />
    </div>
  );
}
