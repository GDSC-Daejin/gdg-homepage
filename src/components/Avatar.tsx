"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

export function Avatar({
  name,
  avatarPath,
  className,
}: {
  name: string;
  avatarPath?: string | null;
  className?: string;
}) {
  const [src, setSrc] = useState<string>();
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSrc(undefined);
    if (!avatarPath) return;

    createClient()
      .storage
      .from("avatars")
      .createSignedUrl(avatarPath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setSrc(data?.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [avatarPath, retries]);

  return (
    <div className={cn("overflow-hidden", className)}>
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => {
            if (retries === 0) setRetries(1);
            else setSrc(undefined);
          }}
        />
      ) : (
        name.slice(0, 1)
      )}
    </div>
  );
}
