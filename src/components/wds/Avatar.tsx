"use client";

import type { CSSProperties } from "react";
import { useAvatarUrl } from "@/components/useAvatarUrl";

/**
 * 참여자 아바타. 원본 목업이 인라인 span으로 그린 것과 같은 규격이다.
 * - responded: 색 채움 + 배경색 2px 링(겹쳐 놓을 때 경계선)
 * - pending: 점선 테두리, 채움 없음
 * 회원 프로필 사진(avatarPath)이 있으면 이니셜 대신 그 사진을 채운다.
 */
export function Avatar({
  initial,
  color,
  size = 30,
  pending = false,
  ring = false,
  avatarPath,
  style,
}: {
  initial: string;
  color?: string;
  size?: number;
  pending?: boolean;
  ring?: boolean;
  avatarPath?: string | null;
  style?: CSSProperties;
}) {
  const { src, onError } = useAvatarUrl(avatarPath);
  const font = size >= 30 ? 12 : size >= 26 ? 11 : 10;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily: "var(--wds-font-sans)",
        font: `700 ${font}px/1 var(--wds-font-sans)`,
        ...(pending
          ? {
              background: "var(--wds-bg)",
              border: "1.5px dashed var(--wds-label-assistive)",
              color: "var(--wds-label-alternative)",
            }
          : {
              background: color,
              color: "#fff",
              ...(ring ? { boxShadow: "0 0 0 2px var(--wds-bg)" } : null),
            }),
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          onError={onError}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initial
      )}
    </span>
  );
}

/** 겹쳐 놓는 아바타 줄. 원본은 padding-left로 첫 칸을 밀고 각 칸을 margin-left 음수로 겹친다. */
export function AvatarRow({
  people,
  size = 30,
  overlap = 8,
}: {
  people: { id: string; initial: string; color: string; avatarPath?: string | null }[];
  size?: number;
  overlap?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", paddingLeft: overlap }}>
      {people.map((p) => (
        <Avatar
          key={p.id}
          initial={p.initial}
          color={p.color}
          size={size}
          ring
          avatarPath={p.avatarPath}
          style={{ marginLeft: -overlap }}
        />
      ))}
    </div>
  );
}
