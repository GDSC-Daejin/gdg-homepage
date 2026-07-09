import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/actions/profile";
import { Button } from "@/components/Button";

export const dynamic = "force-dynamic";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link href="/">홈</Link>
            <Link href="/attend">출석</Link>
            <Link href="/notices">공지</Link>
            <Link href="/materials">자료실</Link>
            <Link href="/surveys">설문</Link>
            <Link href="/inquiries">문의</Link>
            <Link href="/profile">프로필</Link>
            {profile.role === "admin" && <Link href="/admin">어드민</Link>}
          </nav>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
