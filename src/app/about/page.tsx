import Link from "next/link";

const HISTORY = [
  { year: "2023", desc: "GDG on Campus DJU 창립" },
  { year: "2024", desc: "첫 DevFest 개최, 회원 50명 돌파" },
  { year: "2025", desc: "웹·안드로이드·AI 스터디 트랙 신설" },
  { year: "2026", desc: "회원 150명 돌파, 12개 프로젝트 진행 중" },
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-[#060608] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-white/50 hover:text-white">
          ← 로그인으로 돌아가기
        </Link>
        <h1 className="mt-6 text-4xl font-extrabold">ABOUT</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          GDG on Campus DJU는 대전대학교 학생 개발자들이 구글 기술을 함께 배우고,
          실제 서비스를 만들어보고, 서로의 성장을 돕는 커뮤니티입니다. 매주 스터디와
          코드리뷰, 정기 해커톤과 DevFest를 통해 아이디어를 제품으로 완성하는 경험을
          제공합니다.
        </p>
        <h2 className="mt-10 text-sm font-bold tracking-widest text-white/40">HISTORY</h2>
        <ul className="mt-4 space-y-3">
          {HISTORY.map((h) => (
            <li key={h.year} className="flex gap-4 text-sm">
              <span className="w-12 font-bold text-[#4285F4]">{h.year}</span>
              <span className="text-white/70">{h.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
