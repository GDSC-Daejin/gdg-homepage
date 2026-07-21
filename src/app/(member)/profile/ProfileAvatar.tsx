"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProfileAvatar } from "@/actions/profile";
import { Avatar } from "@/components/Avatar";
import { avatarPath, validateAvatarFile } from "@/lib/avatar";
import type { Profile } from "@/lib/types";

export function ProfileAvatar({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState(profile.avatar_path);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);

  async function handleChange(file: File | undefined) {
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(undefined);
    setUploading(true);
    const path = avatarPath(profile.id);
    const { createClient } = await import("@/lib/supabase/client");
    const { error: uploadError } = await createClient()
      .storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "0" });

    if (uploadError) {
      setError("프로필 사진을 저장하지 못했어요");
      setUploading(false);
      return;
    }

    const result = await setProfileAvatar(path);
    if (result.error) {
      setError(result.error);
    } else {
      setCurrentPath(path);
      setVersion((current) => current + 1);
      router.refresh();
    }
    setUploading(false);
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <Avatar
        key={`${currentPath ?? "empty"}-${version}`}
        name={profile.name}
        avatarPath={currentPath}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary"
      />
      <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
        {uploading ? "저장 중" : "사진 변경"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={uploading}
          onClick={(event) => {
            event.currentTarget.value = "";
          }}
          onChange={(event) => handleChange(event.target.files?.[0])}
        />
      </label>
      {error && <p className="max-w-32 text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
