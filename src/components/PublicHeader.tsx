import Link from "next/link";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { label: "About", href: "/about" },
  { label: "Team", href: "/team" },
  { label: "Activities", href: "/events" },
  { label: "Projects", href: "/projects" },
];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-black/30 backdrop-blur-lg backdrop-saturate-150">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="text-sm font-bold text-white">GDGOC DJU</span>
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
          <Link
            href="/apply"
            className="ml-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-[color,background-color,transform] hover:bg-primary/90 active:scale-[0.97]"
          >
            지원하기
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition-[color,background-color,transform] hover:bg-white/10 active:scale-[0.97]"
          >
            로그인
          </Link>
        </div>
      </div>
    </header>
  );
}
