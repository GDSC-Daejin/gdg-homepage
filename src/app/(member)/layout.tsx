import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { signOut } from "@/actions/profile";
import { Button } from "@/components/Button";
import { SidebarNav } from "./SidebarNav";

export const dynamic = "force-dynamic";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-6">
        <SidebarNav isAdmin={profile.role === "admin"} />
        <form action={signOut} className="mt-auto pt-6">
          <Button type="submit" variant="ghost" size="sm">
            로그아웃
          </Button>
        </form>
      </aside>
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
