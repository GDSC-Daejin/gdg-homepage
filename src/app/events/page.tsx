import Link from "next/link";

const EVENTS = [
  { date: "2026.03.14", title: "DevFest Warm-up", desc: "매주 목요일 저녁, 세미나실 B · 웹·AI·클라우드 스터디" },
  { date: "2026.04.02", title: "Android 핸즈온", desc: "Jetpack Compose로 만드는 첫 앱 · 초급 환영" },
  { date: "2026.04.25", title: "교내 해커톤", desc: "48시간 팀 프로젝트 · 대진대학교 창업지원센터" },
  { date: "2026.05.16", title: "DevFest DJU", desc: "연례 컨퍼런스 · 외부 개발자 초청 세션" },
];

export default function EventsPage() {
  return (
    <div className="min-h-dvh bg-[#060608] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-white/50 hover:text-white">
          ← 로그인으로 돌아가기
        </Link>
        <h1 className="mt-6 text-4xl font-extrabold">EVENTS</h1>
        <p className="mt-4 text-white/70">다가오는 모임과 행사 일정입니다.</p>
        <ul className="mt-10 space-y-6">
          {EVENTS.map((e) => (
            <li key={e.title} className="border-b border-white/10 pb-6">
              <div className="text-xs font-bold tracking-widest text-[#FBBC04]">{e.date}</div>
              <div className="mt-1 text-lg font-bold">{e.title}</div>
              <div className="mt-1 text-sm text-white/60">{e.desc}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
