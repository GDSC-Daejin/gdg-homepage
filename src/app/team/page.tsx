import Link from "next/link";

const TEAM = [
  { name: "김도현", role: "회장 · 웹트랙", initials: "DH" },
  { name: "이서윤", role: "부회장 · AI트랙", initials: "SY" },
  { name: "박준영", role: "운영진 · 안드로이드트랙", initials: "JY" },
  { name: "최지아", role: "운영진 · 클라우드트랙", initials: "JA" },
];

export default function TeamPage() {
  return (
    <div className="min-h-dvh bg-[#060608] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-white/50 hover:text-white">
          ← 로그인으로 돌아가기
        </Link>
        <h1 className="mt-6 text-4xl font-extrabold">TEAM</h1>
        <p className="mt-4 text-white/70">GDG on Campus DJU 운영진입니다.</p>
        <ul className="mt-10 space-y-4">
          {TEAM.map((m) => (
            <li key={m.name} className="flex items-center gap-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4] to-[#34A853] text-sm font-bold">
                {m.initials}
              </span>
              <div>
                <div className="font-bold">{m.name}</div>
                <div className="text-sm text-white/60">{m.role}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
