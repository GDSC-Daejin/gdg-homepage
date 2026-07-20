"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroup, updateGroup } from "@/actions/group";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { CURRENT_SEASON } from "@/lib/constants";
import type { Group } from "@/lib/types";

const fieldClassName = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-[border-color,box-shadow] placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary-soft dark:bg-gray-100";

export function GroupForm({ group }: { group?: Group }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const isEditing = Boolean(group);
  const seasons = [...new Set([CURRENT_SEASON, group?.season].filter(Boolean))] as string[];

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = group
      ? await updateGroup(group.id, formData)
      : await createGroup(formData);
    setPending(false);
    if (result.error) return setError(result.error);
    router.refresh();
    if (!group) {
      (document.getElementById("group-form") as HTMLFormElement | null)?.reset();
    }
  }

  return (
    <form
      id="group-form"
      action={onSubmit}
      className="h-full rounded-xl border border-gray-200 bg-white p-5 shadow-card dark:bg-gray-100 sm:p-6"
    >
      <div className="mb-5">
        <Badge tone="primary">{isEditing ? "그룹 수정" : "그룹 생성"}</Badge>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-gray-900">{isEditing ? "그룹 정보 수정" : "새 그룹 만들기"}</h2>
        <p className="mt-1 text-sm text-gray-500">{isEditing ? "그룹 정보를 수정하세요" : "그룹 정보를 입력해 생성하세요"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="type" label="종류" defaultValue={group?.type ?? "study"} required>
          <option value="study">스터디</option>
          <option value="project">프로젝트</option>
        </Select>
        <Select name="status" label="상태" defaultValue={group?.status ?? "recruiting"} required>
          <option value="recruiting">모집중</option>
          <option value="active">진행중</option>
          <option value="archived">종료</option>
        </Select>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 sm:col-span-2">
          제목
          <input name="title" defaultValue={group?.title} placeholder="제목을 입력하세요" required className={fieldClassName} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 sm:col-span-2">
          설명
          <input name="description" defaultValue={group?.description} placeholder="설명을 입력하세요" className={fieldClassName} />
        </label>
        <Select name="season" label="기수" defaultValue={group?.season ?? CURRENT_SEASON} required>
          {seasons.map((season) => <option key={season} value={season}>{season}</option>)}
        </Select>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700">
          정원 (선택)
          <input name="capacity" type="number" min={1} defaultValue={group?.capacity ?? ""} placeholder="숫자를 입력하세요" className={fieldClassName} />
        </label>
      </div>

      <div className="mt-5 border-t border-gray-200 pt-5">
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" disabled={pending} className="w-full">
          {isEditing ? "수정" : "그룹 만들기"}
        </Button>
      </div>
    </form>
  );
}
