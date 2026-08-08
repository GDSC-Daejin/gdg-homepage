import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { SectionTabs, SYSTEM_TABS } from "../SectionTabs";

export const dynamic = "force-dynamic";

/** 어드민 곳곳에 흩어져 있던 미리보기·개발용 화면의 단일 진입점. */
const sections: { title: string; links: { href: string; label: string; description: string }[] }[] = [
  {
    title: "포켓몬",
    links: [
      {
        href: "/admin/pokedex?tab=development",
        label: "포켓몬 개발",
        description: "듀얼 미리보기와 개발 중인 화면 모음",
      },
      {
        href: "/admin/pokedex/ranking",
        label: "새 랭킹전 — 홈",
        description: "최근 디자인을 반영한 랭킹전 홈",
      },
      {
        href: "/admin/pokedex/ranking/attack",
        label: "새 랭킹전 — 공격",
        description: "공격 화면 미리보기",
      },
      {
        href: "/admin/pokedex/ranking/deck",
        label: "새 랭킹전 — 내 덱",
        description: "내 덱 화면 미리보기",
      },
      {
        href: "/admin/pokedex/ranking/log",
        label: "새 랭킹전 — 기록",
        description: "전투 기록 화면 미리보기",
      },
    ],
  },
  {
    title: "화면 미리보기",
    links: [
      {
        href: "/landing-preview",
        label: "랜딩 미리보기",
        description: "로그인 전 첫 화면",
      },
      {
        href: "/ranking-preview",
        label: "랭킹 미리보기",
        description: "예시 데이터로 그린 랭킹 화면",
      },
    ],
  },
];

export default async function AdminDevPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <SectionTabs tabs={SYSTEM_TABS} label="시스템" />
      <PageHeader
        title="개발"
        description="미리보기와 개발용 화면을 한곳에 모아뒀어요"
      />

      {sections.map((section) => (
        <Card key={section.title}>
          <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
          <ul className="mt-3 flex flex-col gap-1">
            {section.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex flex-col rounded-md px-3 py-2 hover:bg-gray-100"
                >
                  <span className="text-sm font-medium text-gray-900">{link.label}</span>
                  <span className="text-xs text-gray-500">{link.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
