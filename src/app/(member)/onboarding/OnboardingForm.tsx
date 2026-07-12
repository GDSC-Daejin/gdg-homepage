"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/profile";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";

const INTEREST_OPTIONS = ["Android", "Web", "iOS", "ML", "Cloud", "Design"];

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input name="name" label="이름" defaultValue={defaultName} required />
      <Input name="student_no" label="학번" required />
      <Input name="major" label="전공" required />
      <Input name="phone" label="전화번호" type="tel" required />
      <Select name="position" label="포지션" defaultValue="" required>
        <option value="" disabled>
          선택
        </option>
        <option value="frontend">프론트엔드</option>
        <option value="backend">백엔드</option>
        <option value="designer">디자이너</option>
      </Select>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">관심 분야</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {INTEREST_OPTIONS.map((interest) => (
            <label
              key={interest}
              className="flex items-center gap-1.5 text-sm text-gray-700"
            >
              <input type="checkbox" name="interests" value={interest} />
              {interest}
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
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
