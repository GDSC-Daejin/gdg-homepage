"use client";

import { cn } from "@/lib/cn";
import { useAvatarUrl } from "./useAvatarUrl";

export function Avatar({
  name,
  avatarPath,
  className,
}: {
  name: string;
  avatarPath?: string | null;
  className?: string;
}) {
  const { src, onError } = useAvatarUrl(avatarPath);

  return (
    <div className={cn("overflow-hidden", className)}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={onError} />
      ) : (
        name.slice(0, 1)
      )}
    </div>
  );
}
