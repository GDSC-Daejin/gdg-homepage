import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { PageSkeleton } from "@/components/PageSkeleton";
import { MemberShell } from "./MemberShell";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<MemberLoading />}>
      <MemberLayoutContent>{children}</MemberLayoutContent>
    </Suspense>
  );
}

async function MemberLayoutContent({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <MemberShell profile={profile}>
      <div className="rounded-[20px] bg-gray-50 p-6 shadow-material sm:p-8">
        {children}
      </div>
    </MemberShell>
  );
}

function MemberLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-[1100px] rounded-[20px] bg-gray-50 p-6 shadow-material sm:p-8">
        <PageSkeleton />
      </div>
    </div>
  );
}
