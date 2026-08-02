import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const alt = "GDG DJU 동아리 관리 시스템";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 파비콘과 동일한 로고 마크를 단일 소스로 재사용
const logoDataUri = `data:image/svg+xml;base64,${readFileSync(
  join(process.cwd(), "src/app/icon.svg"),
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          background: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={300} height={300} alt="" />
        <div style={{ fontSize: 76, fontWeight: 700, color: "#202124" }}>
          GDG DJU
        </div>
      </div>
    ),
    { ...size },
  );
}
