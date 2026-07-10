"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/profile";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import type { Profile } from "@/lib/types";

const INTEREST_OPTIONS = ["Android", "Web", "iOS", "ML", "Cloud", "Design"];

interface ProfileFormProps {
  profile: Profile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
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
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input name="name" label="이름" defaultValue={profile.name} required />
      <Input name="student_no" label="학번" defaultValue={profile.student_no} />
      <Input name="major" label="전공" defaultValue={profile.major} />
      <Input name="phone" label="전화번호" defaultValue={profile.phone} />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">관심 분야</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {INTEREST_OPTIONS.map((interest) => (
            <label
              key={interest}
              className="flex items-center gap-1.5 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                name="interests"
                value={interest}
                defaultChecked={profile.interests.includes(interest)}
              />
              {interest}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {saved && !error && <p className="text-xs text-success">저장됐어요</p>}
      <Button
        type="submit"
        variant="primary"
        className="mt-2 w-full"
        disabled={pending}
      >
        저장
      </Button>
    </form>
  );
}
