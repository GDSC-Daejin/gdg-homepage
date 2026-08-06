"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/profile";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";
import type { Profile } from "@/lib/types";

const INTEREST_OPTIONS = ["Android", "Web", "iOS", "ML", "Cloud", "Design"];
const REQUIRED_FIELDS = ["name", "nickname", "student_no", "major", "phone", "position", "academic_status"] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export function OnboardingForm({
  profile,
  submitted,
}: {
  profile: Profile;
  /** 이미 제출한 뒤라면 승인 대기 중 오타를 고치는 용도다. */
  submitted: boolean;
}) {
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<RequiredField, string>>({
    name: profile.name ?? "",
    nickname: profile.nickname ?? "",
    student_no: profile.student_no ?? "",
    major: profile.major ?? "",
    phone: profile.phone ?? "",
    position: profile.position ?? "",
    academic_status: profile.academic_status ?? "",
  });
  const [interests, setInterests] = useState<string[]>(profile.interests ?? []);
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
    setSaved(false);
    startTransition(async () => {
      // 첫 제출이면 updateProfile이 "/"로 보내고, 승인 게이트가 이 화면으로 되돌린다.
      const result = await updateProfile(formData);
      if (result?.error) setError(result.error);
      else setSaved(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <Input name="name" label="이름" defaultValue={profile.name} onChange={(event) => updateValue("name", event.target.value)} required />
      <Input
        name="nickname"
        label="영어 닉네임"
        placeholder="활동에 사용할 영어 닉네임"
        defaultValue={profile.nickname}
        onChange={(event) => updateValue("nickname", event.target.value)}
        required
      />
      <Input name="student_no" label="학번" defaultValue={profile.student_no} onChange={(event) => updateValue("student_no", event.target.value)} required />
      <Input name="major" label="전공" defaultValue={profile.major} onChange={(event) => updateValue("major", event.target.value)} required />
      <Input name="phone" label="전화번호" type="tel" defaultValue={profile.phone} onChange={(event) => updateValue("phone", event.target.value)} required />
      <Select name="position" label="포지션" defaultValue={profile.position ?? ""} onChange={(event) => updateValue("position", event.target.value)} required>
        <option value="" disabled>
          선택
        </option>
        <option value="frontend">프론트엔드</option>
        <option value="backend">백엔드</option>
        <option value="designer">디자이너</option>
        <option value="beginner">비기너</option>
      </Select>
      <Select name="academic_status" label="재학여부" defaultValue={profile.academic_status ?? ""} onChange={(event) => updateValue("academic_status", event.target.value)} required>
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
      {saved && !error && (
        <p className="text-xs text-primary">수정한 내용을 저장했어요.</p>
      )}
      <Button
        type="submit"
        variant="primary"
        className="mt-2 w-full"
        disabled={pending || !isComplete}
      >
        {submitted ? "수정 내용 저장" : "제출"}
      </Button>
    </form>
  );
}
