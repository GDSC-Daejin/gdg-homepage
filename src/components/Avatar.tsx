"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

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
    let active = true;
    setSrc(undefined);
    if (!avatarPath) return;

    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient()
        .storage
        .from("avatars")
        .createSignedUrl(avatarPath, 60 * 60);
      if (active) setSrc(data?.signedUrl);
    })();

    return () => {
      active = false;
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
