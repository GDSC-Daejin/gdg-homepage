import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { PublicHeader } from "@/components/PublicHeader";
import { JsonLd, breadcrumb } from "@/components/JsonLd";
import { POSITION_LABELS } from "@/lib/types";
import { loadTeamMembers } from "./team-data";

export const metadata = {
  title: "팀",
  description:
    "GDG on Campus DJU 운영진을 소개합니다. 오거나이저와 팀 멤버가 프론트엔드·백엔드·디자이너 파트로 활동해요.",
  alternates: { canonical: "/team" },
};

const PARTS = [
  { key: "frontend", desc: "사용자가 만나는 화면을 세심하게 만들어요" },
  { key: "backend", desc: "서비스를 안정적으로 움직이는 서버와 데이터를 다뤄요" },
  { key: "designer", desc: "사용자 경험과 브랜드를 시각적으로 완성해요" },
] as const;

function MemberCard({
  nickname,
  avatarPath,
}: {
  nickname: string;
  avatarPath: string | null;
}) {
  return (
    <div className="flex items-center gap-4">
      <Avatar
        name={nickname}
        avatarPath={avatarPath}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4] to-[#34A853] text-sm font-bold"
      />
      <div className="font-bold">{nickname}</div>
    </div>
  );
}

export default async function TeamPage() {
  const { organizers, teamMembers } = await loadTeamMembers();

  return (
    <div className="min-h-dvh bg-[#060608] text-white">
      <JsonLd data={breadcrumb("팀", "/team")} />
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight">TEAM</h1>
        <p className="mt-4 text-white/70">GDG on Campus DJU 운영진입니다.</p>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          오거나이저
        </h2>
        <ul className="mt-4 space-y-4">
          {organizers.map((member) => (
            <li key={member.id}>
              <MemberCard {...member} />
            </li>
          ))}
        </ul>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          팀 멤버
        </h2>
        <ul className="mt-4 space-y-4">
          {teamMembers.map((member) => (
            <li key={member.id}>
              <MemberCard {...member} />
            </li>
          ))}
        </ul>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          파트 소개
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {PARTS.map((p) => (
            <div
              key={p.key}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="font-semibold text-white">{POSITION_LABELS[p.key]}</p>
              <p className="mt-1.5 text-sm text-white/60">{p.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          CONTACT &amp; LINKS
        </h2>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white/70">
            가입 문의는 지원 페이지를 이용해주세요.
          </p>
          <Link
            href="/apply"
            className="mt-3 inline-block text-sm font-semibold text-white/80 hover:text-white"
          >
            지원 페이지로 이동 →
          </Link>
        </div>
      </div>
    </div>
  );
}
