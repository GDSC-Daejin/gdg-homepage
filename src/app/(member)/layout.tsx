import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
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

  return <MemberShell profile={profile}>{children}</MemberShell>;
}
