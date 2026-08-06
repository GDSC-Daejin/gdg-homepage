"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/profile";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";

const INTEREST_OPTIONS = ["Android", "Web", "iOS", "ML", "Cloud", "Design"];
const REQUIRED_FIELDS = ["name", "nickname", "student_no", "major", "phone", "position", "academic_status"] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<RequiredField, string>>({
    name: defaultName ?? "",
    nickname: "",
    student_no: "",
    major: "",
    phone: "",
    position: "",
    academic_status: "",
  });
  const [interests, setInterests] = useState<string[]>([]);
  const isComplete = REQUIRED_FIELDS.every((field) => values[field].trim()) && interests.length > 0;

  function updateValue(field: RequiredField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest) ? current.filter((value) => value !== interest) : [...current, interest],
    );
  }

  function handleSubmit(formData: FormData) {
    if (!isComplete) {
      setError("모든 필수 항목을 입력해주세요");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input name="name" label="이름" defaultValue={defaultName} onChange={(event) => updateValue("name", event.target.value)} required />
      <Input
        name="nickname"
        label="영어 닉네임"
        placeholder="활동에 사용할 영어 닉네임"
        onChange={(event) => updateValue("nickname", event.target.value)}
        required
      />
      <Input name="student_no" label="학번" onChange={(event) => updateValue("student_no", event.target.value)} required />
      <Input name="major" label="전공" onChange={(event) => updateValue("major", event.target.value)} required />
      <Input name="phone" label="전화번호" type="tel" onChange={(event) => updateValue("phone", event.target.value)} required />
      <Select name="position" label="포지션" defaultValue="" onChange={(event) => updateValue("position", event.target.value)} required>
        <option value="" disabled>
          선택
        </option>
        <option value="frontend">프론트엔드</option>
        <option value="backend">백엔드</option>
        <option value="designer">디자이너</option>
        <option value="beginner">비기너</option>
      </Select>
      <Select name="academic_status" label="재학여부" defaultValue="" onChange={(event) => updateValue("academic_status", event.target.value)} required>
        <option value="" disabled>
          선택
        </option>
        <option value="enrolled">재학</option>
        <option value="leave">휴학</option>
        <option value="graduated">졸업</option>
        <option value="completed">수료</option>
      </Select>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">관심 분야 <span aria-hidden="true" className="text-danger">*</span></span>
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
                checked={interests.includes(interest)}
                onChange={() => toggleInterest(interest)}
              />
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
        disabled={pending || !isComplete}
      >
        저장
      </Button>
    </form>
  );
}
