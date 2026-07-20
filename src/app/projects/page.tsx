import Link from "next/link";

const PROJECTS = [
  { title: "Campus Map AI", desc: "캠퍼스 길찾기 · Gemini 기반", color: "#4285F4" },
  { title: "Event Hub", desc: "행사 등록 플랫폼 · Firebase", color: "#EA4335" },
  { title: "StudyMate", desc: "스터디 매칭 앱 · Flutter", color: "#FBBC04" },
  { title: "GDG Bot", desc: "커뮤니티 슬랙 봇 · Cloud Functions", color: "#34A853" },
];

export default function ProjectsPage() {
  return (
    <div className="min-h-dvh bg-[#060608] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-white/50 hover:text-white">
          ← 메인으로 돌아가기
        </Link>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight">PROJECTS</h1>
        <p className="mt-4 text-white/70">멤버들이 진행 중인 프로젝트입니다.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {PROJECTS.map((p) => (
            <div key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
              <div className="mt-3 text-lg font-bold">{p.title}</div>
              <div className="mt-1 text-sm text-white/60">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
