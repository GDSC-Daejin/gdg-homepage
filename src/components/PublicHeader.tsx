import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { getRecruitingSettings } from "@/lib/recruiting";
import { ADMIN_ROLES } from "@/lib/types";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { label: "About", href: "/about" },
  { label: "Team", href: "/team" },
  { label: "Activities", href: "/events" },
  { label: "Projects", href: "/projects" },
];

export async function PublicHeader() {
  const [profile, settings] = await Promise.all([
    getProfile(),
    getRecruitingSettings(),
  ]);
  const isAdmin = profile ? ADMIN_ROLES.includes(profile.role) : false;

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-black/30 backdrop-blur-lg backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="text-sm font-bold text-white">GDG DJU</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          {settings.is_open ? (
            <Link
              href="/apply"
              className="ml-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-[color,background-color,transform] hover:bg-primary/90 active:scale-[0.97]"
            >
              지원하기
            </Link>
          ) : (
            <Link
              href="/apply"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              지원하기
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              어드민
            </Link>
          )}
          {profile ? (
            <Link
              href="/"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition-[color,background-color,transform] hover:bg-white/10 active:scale-[0.97]"
            >
              대시보드
            </Link>
          ) : (
            <Link
              href="/"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition-[color,background-color,transform] hover:bg-white/10 active:scale-[0.97]"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
