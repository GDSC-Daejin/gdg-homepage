"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { signOut, updateProfile } from "@/actions/profile";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/wds/Toast";
import { onboardingProfileSchema } from "@/lib/schemas";
import type { Profile } from "@/lib/types";
import type { z } from "zod";

const INTEREST_OPTIONS = ["Android", "Web", "iOS", "ML", "Cloud", "Design"];

type OnboardingValues = z.input<typeof onboardingProfileSchema>;

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function OnboardingForm({
  profile,
  submitted,
}: {
  profile: Profile;
  submitted: boolean;
}) {
  const [error, setError] = useState<string>();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { show, toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingProfileSchema),
    mode: "onChange",
    defaultValues: {
      name: profile.name ?? "",
      nickname: profile.nickname ?? "",
      student_no: profile.student_no ?? "",
      major: profile.major ?? "",
      phone: formatPhone(profile.phone ?? ""),
      position: profile.position ?? undefined,
      academic_status: profile.academic_status ?? undefined,
      interests: profile.interests ?? [],
    },
  });
  const interests = watch("interests");
  const position = watch("position");
  const academicStatus = watch("academic_status");

  useEffect(() => {
    void trigger();
  }, [trigger]);

  async function submit(values: OnboardingValues) {
    setError(undefined);
    const formData = new FormData();
    formData.set("name", values.name);
    formData.set("nickname", values.nickname);
    formData.set("student_no", values.student_no);
    formData.set("major", values.major);
    formData.set("phone", values.phone);
    formData.set("position", values.position);
    formData.set("academic_status", values.academic_status);
    values.interests.forEach((interest) => formData.append("interests", interest));

    const result = await updateProfile(formData);
    if (result?.error) setError(result.error);
    else {
      reset(values);
      show("수정한 내용을 저장했어요", "positive");
    }
  }

  function requestSignOut() {
    if (isDirty) setLogoutOpen(true);
    else void signOut();
  }

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <Input label="이름" error={errors.name?.message} required {...register("name")} />
      <Input
        label="영어 닉네임"
        placeholder="활동에 사용할 영어 닉네임"
        error={errors.nickname?.message}
        required
        {...register("nickname", {
          onChange: (event) => setValue("nickname", event.target.value.replace(/[ㄱ-ㅎㅏ-ㅣ가-힣]/g, ""), { shouldValidate: true }),
        })}
      />
      <Input
        label="학번"
        error={errors.student_no?.message}
        inputMode="numeric"
        maxLength={8}
        required
        {...register("student_no", {
          onChange: (event) => setValue("student_no", event.target.value.replace(/\D/g, "").slice(0, 8), { shouldValidate: true }),
        })}
      />
      <Input label="전공" error={errors.major?.message} required {...register("major")} />
      <Input
        label="전화번호"
        type="tel"
        error={errors.phone?.message}
        inputMode="numeric"
        maxLength={13}
        placeholder="010-1234-5678"
        required
        {...register("phone", {
          onChange: (event) => setValue("phone", formatPhone(event.target.value), { shouldValidate: true }),
        })}
      />
      <Select
        name="position"
        label="포지션"
        value={position}
        error={errors.position?.message}
        onChange={(event) => setValue("position", event.target.value as OnboardingValues["position"], { shouldValidate: true })}
        required
      >
        <option value="" disabled>선택</option>
        <option value="frontend">프론트엔드</option>
        <option value="backend">백엔드</option>
        <option value="designer">디자이너</option>
        <option value="beginner">비기너</option>
      </Select>
      <Select
        name="academic_status"
        label="재학여부"
        value={academicStatus}
        error={errors.academic_status?.message}
        onChange={(event) => setValue("academic_status", event.target.value as OnboardingValues["academic_status"], { shouldValidate: true })}
        required
      >
        <option value="" disabled>선택</option>
        <option value="enrolled">재학</option>
        <option value="leave">휴학</option>
        <option value="graduated">졸업</option>
        <option value="completed">수료</option>
      </Select>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-700">관심 분야 <span aria-hidden className="text-danger">*</span></span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {INTEREST_OPTIONS.map((interest) => (
            <label key={interest} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={interests.includes(interest)}
                onChange={() => setValue(
                  "interests",
                  interests.includes(interest)
                    ? interests.filter((value) => value !== interest)
                    : [...interests, interest],
                  { shouldValidate: true },
                )}
              />
              {interest}
            </label>
          ))}
        </div>
        {errors.interests && <p role="alert" className="text-xs text-danger">{errors.interests.message}</p>}
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={isSubmitting}>
        {submitted ? "수정 내용 저장" : "제출"}
      </Button>
      {submitted && (
        <Button type="button" variant="ghost" className="mt-2 w-full" onClick={requestSignOut}>
          로그아웃
        </Button>
      )}
      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} ariaLabel="로그아웃 확인">
        <h2 className="text-base font-semibold text-gray-900">저장하지 않고 로그아웃할까요?</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">수정 중인 내용은 저장되지 않고 사라집니다.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setLogoutOpen(false)}>계속 수정</Button>
          <Button type="button" variant="danger" onClick={() => void signOut()}>로그아웃</Button>
        </div>
      </Modal>
      {toast}
    </form>
  );
}
