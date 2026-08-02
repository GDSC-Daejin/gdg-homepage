export const AVATAR_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export function avatarPath(userId: string): string {
  return `${userId}/avatar`;
}

export function isOwnAvatarPath(userId: string, path: string): boolean {
  return path === avatarPath(userId);
}

export function validateAvatarFile(file: Pick<Blob, "type" | "size">): string | undefined {
  if (!AVATAR_ACCEPTED_TYPES.includes(file.type as (typeof AVATAR_ACCEPTED_TYPES)[number])) {
    return "PNG, JPEG, WebP 이미지만 올릴 수 있어요";
  }
  if (file.size > AVATAR_MAX_BYTES) return "프로필 사진은 5MB 이하만 올릴 수 있어요";
}
