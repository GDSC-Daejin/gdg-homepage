import type { NextConfig } from "next";

// CSP는 인라인 테마 스크립트(layout.tsx)와 Vercel Analytics/Supabase 호출을 깨뜨리지 않도록
// Report-Only로 먼저 넣어 위반만 수집한다. (enforce + nonce 배선은 후속 작업)
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://www.google-analytics.com",
  "connect-src 'self' https://*.supabase.co https://api.resend.com https://www.google-analytics.com https://www.googletagmanager.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/PokeAPI/sprites/**" },
    ],
  },
  experimental: {
    // Turbopack 영속 dev 캐시 손상으로 proxy 어댑터 누락("adapterFn is not a function")이
    // 반복 발생 → dev 캐시 비활성화. 관련: vercel/next.js#87283
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
        ],
      },
    ];
  },
};

export default nextConfig;
