import { PublicHeader } from "@/components/PublicHeader";
import { JsonLd, breadcrumb } from "@/components/JsonLd";

export const metadata = {
  title: "소개",
  description:
    "GDGOC DJU는 함께 성장·실전 빌드·커뮤니티·오픈소스를 가치로 하는 대진대학교 개발자 동아리입니다. 정기세션·스터디·모각코·프로젝트로 활동해요.",
  alternates: { canonical: "/about" },
};

const HISTORY = [
  { year: "2023", desc: "GDGOC DJU 창립" },
  { year: "2024", desc: "첫 연합 해커톤 개최, 회원 50명 돌파" },
  { year: "2025", desc: "웹·안드로이드·AI 스터디 트랙 신설" },
  { year: "2026", desc: "회원 150명 돌파, 12개 프로젝트 진행 중" },
];

const CORE_VALUES = [
  { title: "함께 성장", desc: "혼자보다 함께일 때 더 멀리 갈 수 있다고 믿어요" },
  { title: "실전 빌드", desc: "배운 것을 직접 만들어보며 익혀요" },
  { title: "커뮤니티", desc: "서로 돕고 나누는 관계를 소중히 여겨요" },
  { title: "오픈 소스", desc: "지식과 코드를 열린 방식으로 공유해요" },
];

const ACTIVITIES = [
  { title: "정기세션", desc: "매주 모여 최신 구글 기술과 개발 트렌드를 함께 배워요" },
  { title: "스터디", desc: "관심 분야별 소규모 팀을 이뤄 꾸준히 학습을 이어가요" },
  { title: "모각코", desc: "각자의 프로젝트를 들고 모여 함께 코드를 완성해요" },
  { title: "프로젝트", desc: "학기 단위로 팀을 꾸려 아이디어를 실제 서비스로 완성해요" },
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-[#060608] text-white">
      <JsonLd data={breadcrumb("소개", "/about")} />
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight">ABOUT</h1>
        <p className="mt-4 text-white/70 leading-relaxed">
          GDGOC DJU는 대진대학교 학생 개발자들이 구글 기술을 함께 배우고,
          실제 서비스를 만들어보고, 서로의 성장을 돕는 커뮤니티입니다. 매주 스터디와
          코드리뷰, 정기 해커톤과 모각코를 통해 아이디어를 제품으로 완성하는 경험을
          제공합니다.
        </p>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          WHAT IS GDG ON CAMPUS
        </h2>
        <p className="mt-4 text-white/70 leading-relaxed">
          GDG on Campus는 구글이 전 세계 대학생 개발자 커뮤니티를 지원하는
          프로그램이에요. 학생들이 캠퍼스 안에서 스스로 학습 문화를 만들고, 실전
          프로젝트를 통해 성장할 수 있도록 돕습니다. GDGOC DJU는 대진대학교의 공식
          GDG on Campus 챕터입니다.
        </p>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          MISSION &amp; VISION
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">Mission</p>
            <p className="mt-1 text-white/70 leading-relaxed">
              학생 개발자들이 두려움 없이 새로운 기술에 도전하고, 함께 성장할 수
              있는 환경을 만듭니다.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Vision</p>
            <p className="mt-1 text-white/70 leading-relaxed">
              대진대학교를 넘어 지역 개발자 커뮤니티를 대표하는 학생 조직으로
              성장하는 것을 목표로 합니다.
            </p>
          </div>
        </div>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          CORE VALUES
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {CORE_VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="font-semibold text-white">{v.title}</p>
              <p className="mt-1.5 text-sm text-white/60">{v.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          WHAT WE DO
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {ACTIVITIES.map((a) => (
            <div
              key={a.title}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="font-semibold text-white">{a.title}</p>
              <p className="mt-1.5 text-sm text-white/60">{a.desc}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-sm font-bold tracking-widest text-white/40">
          HISTORY
        </h2>
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
