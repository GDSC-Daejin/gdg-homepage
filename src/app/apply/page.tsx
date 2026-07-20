import Link from "next/link";
import { getRecruitingSettings, isRecruitingOpen } from "@/lib/recruiting";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ApplyForm } from "./ApplyForm";
import { JsonLd, breadcrumb } from "@/components/JsonLd";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "지원하기",
  description:
    "대진대학교 GDG on Campus 멤버 지원. 로그인 없이 바로 지원서를 작성할 수 있어요.",
  alternates: { canonical: "/apply" },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "GDG on Campus DJU는 어떻게 지원하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "서류 접수 → 운영진 심사 → 결과 이메일 안내 순으로 진행돼요. 로그인 없이 이 페이지에서 바로 지원서를 작성할 수 있어요.",
      },
    },
    {
      "@type": "Question",
      name: "언제 모집하나요?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "학기 단위로 모집하며, 모집이 열리면 지원 페이지에서 바로 접수할 수 있어요.",
      },
    },
  ],
};

const STEPS = [
  { title: "서류 접수", description: "지원서를 작성해 제출해요" },
  { title: "운영진 심사", description: "운영진이 지원서를 검토해요" },
  { title: "결과 이메일 안내", description: "입력한 이메일로 결과를 안내드려요" },
];

export default async function ApplyPage() {
  const settings = await getRecruitingSettings();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
      <JsonLd data={faqLd} />
      <JsonLd data={breadcrumb("지원하기", "/apply")} />
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← GDG DJU
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900">지원하기</h1>
        <p className="mt-1 text-sm text-gray-500">
          {settings.season} 리크루팅 · 로그인 없이 바로 지원할 수 있어요
        </p>
      </div>
      {!isRecruitingOpen(settings) ? (
        <Card className="flex flex-col items-center gap-2 text-center">
          <p className="text-base font-semibold text-gray-900">
            지금은 모집 기간이 아니에요
          </p>
          <p className="text-sm text-gray-500">
            모집이 열리면 이 페이지에서 바로 지원할 수 있어요
          </p>
          <Link href="/events">
            <Button type="button" variant="primary" className="mt-2">
              활동 둘러보기
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <p className="mb-3 text-sm font-semibold text-gray-900">지원 절차</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
              {STEPS.map((step, i) => (
                <div key={step.title} className="flex flex-1 items-start gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <ApplyForm openPositions={settings.open_positions} />
          </Card>
        </>
      )}
    </div>
  );
}
