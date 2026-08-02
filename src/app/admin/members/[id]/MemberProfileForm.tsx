"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateMemberProfile } from "@/actions/member";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function MemberProfileForm({
  userId,
  name,
  nickname,
  studentNo,
  major,
  phone,
  interests,
}: {
  userId: string;
  name: string;
  nickname: string;
  studentNo: string;
  major: string;
  phone: string;
  interests: string[];
}) {
  const [nameValue, setNameValue] = useState(name);
  const [nicknameValue, setNicknameValue] = useState(nickname);
  const [studentNoValue, setStudentNoValue] = useState(studentNo);
  const [majorValue, setMajorValue] = useState(major);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [interestsValue, setInterestsValue] = useState(interests.join(", "));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateMemberProfile(userId, {
        name: nameValue,
        nickname: nicknameValue,
        student_no: studentNoValue,
        major: majorValue,
        phone: phoneValue,
        interests: interestsValue
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      });
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="이름"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          disabled={pending}
        />
        <Input
          label="영어 닉네임"
          value={nicknameValue}
          onChange={(e) => setNicknameValue(e.target.value)}
          disabled={pending}
        />
        <Input
          label="학번"
          value={studentNoValue}
          onChange={(e) => setStudentNoValue(e.target.value)}
          disabled={pending}
        />
        <Input
          label="전공"
          value={majorValue}
          onChange={(e) => setMajorValue(e.target.value)}
          disabled={pending}
        />
        <Input
          label="전화번호"
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
          disabled={pending}
        />
        <Input
          label="관심 분야 (쉼표로 구분)"
          value={interestsValue}
          onChange={(e) => setInterestsValue(e.target.value)}
          disabled={pending}
          className="col-span-2"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          저장
        </Button>
        {saved && !error && <p className="text-xs text-success">저장했어요</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </form>
  );
}
