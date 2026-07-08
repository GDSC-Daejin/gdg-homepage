import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GDG DJU 동아리 관리 시스템",
  description: "GDG DJU 동아리 운영을 위한 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
