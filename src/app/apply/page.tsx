import Link from "next/link";
import { CURRENT_SEASON } from "@/lib/constants";
import { Card } from "@/components/Card";
import { ApplyForm } from "./ApplyForm";

export const metadata = {
  title: "지원하기 · GDG DJU",
};

export default function ApplyPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← GDG DJU
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-gray-900">지원하기</h1>
        <p className="mt-1 text-sm text-gray-500">
          {CURRENT_SEASON} 리크루팅 · 로그인 없이 바로 지원할 수 있어요
        </p>
      </div>
      <Card>
        <ApplyForm />
      </Card>
    </div>
  );
}
