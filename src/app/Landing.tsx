import Link from "next/link";
import { getRecruitingSettings } from "@/lib/recruiting";
import { PublicHeader } from "@/components/PublicHeader";

const ACTIVITIES = [
  {
    title: "정기세션",
    color: "#4285F4",
    desc: "매주 모여 최신 구글 기술과 개발 트렌드를 함께 배워요",
  },
  {
    title: "스터디",
    color: "#EA4335",
    desc: "관심 분야별 소규모 팀을 이뤄 꾸준히 학습을 이어가요",
  },
  {
    title: "모각코",
    color: "#FBBC04",
    desc: "각자의 프로젝트를 들고 모여 함께 코드를 완성해요",
  },
];

export async function Landing() {
  const settings = await getRecruitingSettings();

  return (
    <div
      className="min-h-dvh text-white"
      style={{
        background:
          "radial-gradient(1400px 1000px at 66% 10%, #17171c 0%, #0b0b0e 58%, #060608 100%)",
      }}
    >
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-6 pb-24">
        {/* 히어로 */}
        <section className="flex flex-col items-center pt-20 pb-16 text-center sm:pt-28">
          {settings.is_open && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "#34A853", boxShadow: "0 0 8px #34A853" }}
              />
              <span className="text-xs font-semibold tracking-wide text-white/80">
                {settings.season} 리크루팅 진행 중
              </span>
            </div>
          )}
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            GDG on Campus DJU
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
            대진대학교 구글 개발자 커뮤니티예요. 함께 배우고 만들고 성장해요.
          </p>
          <div className="mt-8">
            {settings.is_open ? (
              <Link
                href="/apply"
                className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                지금 지원하기
              </Link>
            ) : (
              <Link
                href="/events"
                className="inline-flex items-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                활동 둘러보기
              </Link>
            )}
          </div>
        </section>

        {/* About 프리뷰 */}
        <section className="border-t border-white/10 py-14">
          <p className="max-w-xl text-white/70 leading-relaxed">
            GDG on Campus DJU는 대진대학교 학생 개발자들이 구글 기술을 함께 배우고,
            실제 서비스를 만들어보며 서로의 성장을 돕는 커뮤니티예요.
          </p>
          <Link
            href="/about"
            className="mt-4 inline-block text-sm font-semibold text-white/80 hover:text-white"
          >
            더 알아보기 →
          </Link>
        </section>

        {/* What We Do */}
        <section className="border-t border-white/10 py-14">
          <h2 className="text-sm font-bold tracking-widest text-white/40">
            WHAT WE DO
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {ACTIVITIES.map((a) => (
              <div
                key={a.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5"
              >
                <span
                  className="mb-3 block h-2 w-2 rounded-full"
                  style={{ background: a.color }}
                />
                <p className="font-semibold text-white">{a.title}</p>
                <p className="mt-1.5 text-sm text-white/60">{a.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Team 프리뷰 */}
        <section className="border-t border-white/10 py-14">
          <Link
            href="/team"
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-6 py-5 transition-colors hover:bg-white/[0.06]"
          >
            <div>
              <p className="font-semibold text-white">운영진 소개</p>
              <p className="mt-1 text-sm text-white/60">
                GDG DJU를 이끌어가는 사람들을 만나보세요
              </p>
            </div>
            <span className="text-white/50">→</span>
          </Link>
        </section>

        {/* 마감 CTA */}
        <section className="border-t border-white/10 py-16 text-center">
          {settings.is_open ? (
            <>
              <p className="text-xl font-bold text-white">
                {settings.season} 신규 멤버를 모집하고 있어요
              </p>
              <p className="mt-2 text-sm text-white/60">
                지금 지원하고 GDG DJU와 함께 성장해요
              </p>
              <Link
                href="/apply"
                className="mt-6 inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                지금 지원하기
              </Link>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-white">
                지금은 모집 기간이 아니에요
              </p>
              <p className="mt-2 text-sm text-white/60">
                다음 모집 전까지 GDG DJU의 활동을 둘러보세요
              </p>
              <Link
                href="/events"
                className="mt-6 inline-flex items-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                활동 둘러보기
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
