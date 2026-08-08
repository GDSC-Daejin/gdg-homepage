import { redirect } from "next/navigation";
import Landing from "@/app/landing-preview/Landing";
import { isDemoMode } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "서비스 미리보기", robots: { index: false, follow: false } };

export default async function TourLandingPage() {
  if (!(await isDemoMode())) redirect("/tour");
  return <Landing tour />;
}
