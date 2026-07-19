import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack 영속 dev 캐시 손상으로 proxy 어댑터 누락("adapterFn is not a function")이
    // 반복 발생 → dev 캐시 비활성화. 관련: vercel/next.js#87283
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
