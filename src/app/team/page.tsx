import Link from "next/link";
import { PublicHeader } from "@/components/PublicHeader";
import { POSITION_LABELS } from "@/lib/types";

const CHAPTER_LEAD = { name: "김도현", role: "회장 · 웹트랙", initials: "DH" };

const CORE_TEAM = [
  { name: "이서윤", role: "부회장 · AI트랙", initials: "SY" },
  { name: "박준영", role: "운영진 · 안드로이드트랙", initials: "JY" },
  { name: "최지아", role: "운영진 · 클라우드트랙", initials: "JA" },
];

const PARTS = [
  { key: "frontend", desc: "사용자가 만나는 화면을 세심하게 만들어요" },
  { key: "backend", desc: "서비스를 안정적으로 움직이는 서버와 데이터를 다뤄요" },
  { key: "designer", desc: "사용자 경험과 브랜드를 시각적으로 완성해요" },
] as const;

function MemberCard({
  name,
  role,
  initials,
}: {
  name: string;
  role: string;
  initials: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4] to-[#34A853] text-sm font-bold">
        {initials}
      </span>
      <div>
        <div className="font-bold">{name}</div>
        <div className="text-sm text-white/60">{role}</div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <div className="min-h-dvh bg-[#060608] text-white">
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight">TEAM</h1>
        <p className="mt-4 text-white/70">GDG on Campus DJU 운영진입니다.</p>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          CHAPTER LEAD
        </h2>
        <div className="mt-4">
          <MemberCard {...CHAPTER_LEAD} />
        </div>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          CORE TEAM
        </h2>
        <ul className="mt-4 space-y-4">
          {CORE_TEAM.map((m) => (
            <li key={m.name}>
              <MemberCard {...m} />
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
