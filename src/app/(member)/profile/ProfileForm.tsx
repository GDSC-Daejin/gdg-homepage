"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/profile";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { ProfileAvatar } from "./ProfileAvatar";
import { cn } from "@/lib/cn";
import { normalizeMajor } from "@/lib/major";
import { POSITION_LABELS, type Profile } from "@/lib/types";

const INTEREST_OPTIONS = ["Android", "Web", "iOS", "ML", "Cloud", "Design"];

interface ProfileFormProps {
  profile: Profile;
  ownedPokemon: { id: string; name_ko: string }[];
}

export function ProfileForm({ profile, ownedPokemon }: ProfileFormProps) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-card dark:bg-gray-100">
      <div className="mb-6 flex items-center gap-4">
        <ProfileAvatar profile={profile} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-gray-900">
            {profile.name}
            {profile.nickname && (
              <span className="ml-1.5 font-medium text-gray-500">
                ({profile.nickname})
              </span>
            )}
          </p>
          <p className="truncate text-sm text-gray-500">
            {[profile.student_no, normalizeMajor(profile.major)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {profile.position && (
          <Badge tone="primary" className="ml-auto shrink-0">
            {POSITION_LABELS[profile.position]}
          </Badge>
        )}
      </div>

      <form action={handleSubmit} className="flex flex-col gap-4">
        <Input name="name" label="이름" defaultValue={profile.name} required />
        <Input
          name="nickname"
          label="영어 닉네임"
          defaultValue={profile.nickname}
          placeholder="활동에 사용할 영어 닉네임"
          required
        />
        <Input name="student_no" label="학번" defaultValue={profile.student_no} />
        <Input name="major" label="전공" defaultValue={profile.major} />
        <Input name="phone" label="전화번호" defaultValue={profile.phone} />
        <Select
          name="featured_pokemon_id"
          label="대표 포켓몬"
          defaultValue={profile.featured_pokemon_id ?? ""}
        >
          <option value="">선택 안 함</option>
          {ownedPokemon.map((pokemon) => <option key={pokemon.id} value={pokemon.id}>{pokemon.name_ko}</option>)}
        </Select>
        <Select
          name="position"
          label="포지션"
          defaultValue={profile.position ?? ""}
          required
        >
          <option value="" disabled>
            선택
          </option>
          <option value="frontend">프론트엔드</option>
          <option value="backend">백엔드</option>
          <option value="designer">디자이너</option>
          <option value="beginner">비기너</option>
        </Select>
        <Select
          name="academic_status"
          label="재학여부"
          defaultValue={profile.academic_status ?? ""}
        >
          <option value="">선택 안 함</option>
          <option value="enrolled">재학</option>
          <option value="leave">휴학</option>
          <option value="graduated">졸업</option>
          <option value="completed">수료</option>
        </Select>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700">관심 분야</span>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <label key={interest} className="group">
                <input
                  type="checkbox"
                  name="interests"
                  value={interest}
                  defaultChecked={profile.interests.includes(interest)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "inline-flex cursor-pointer select-none items-center rounded-full border px-3 py-1.5 text-sm font-medium text-gray-600 transition-[color,background-color,border-color,scale]",
                    "border-gray-300 hover:bg-gray-50 active:scale-95",
                    "peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary",
                    "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
                  )}
                >
                  {interest}
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="mt-2 flex flex-col items-center gap-2">
          <Button type="submit" variant="primary" className="w-full" disabled={pending}>
            저장
          </Button>
          <p
            className={cn(
              "text-xs font-medium text-success transition-opacity",
              saved && !error ? "opacity-100" : "opacity-0",
            )}
          >
            저장됐어요
          </p>
        </div>
      </form>
    </div>
  );
}
