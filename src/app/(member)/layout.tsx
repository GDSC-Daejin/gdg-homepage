import { redirect } from "next/navigation";
import { getProfile, assertApproved } from "@/lib/auth";
import { MemberShell } from "./MemberShell";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/");
  assertApproved(profile);

  return (
    <MemberShell profile={profile}>
      <div className="rounded-[20px] bg-gray-50 p-6 shadow-material sm:p-8">
        {children}
      </div>
    </MemberShell>
  );
}
