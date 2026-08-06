"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignGroupMember, removeMember, setGroupPublic } from "@/actions/group";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import type { Group, Profile } from "@/lib/types";

export function GroupActions({ group }: { group: Group }) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(group.is_public);

  async function toggle() {
    const next = !isPublic;
    setIsPublic(next);
    const result = await setGroupPublic(group.id, next);
    if (result.error) setIsPublic(!next);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={isPublic} onChange={toggle} />
      공개 페이지(/projects)에 노출
    </label>
  );
}

export function RemoveGroupMemberButton({
  groupId,
  userId,
}: {
  groupId: string;
  userId: string;
}) {
  const router = useRouter();

  async function remove() {
    if (!confirm("이 멤버를 제거할까요?")) return;
    const result = await removeMember(groupId, userId);
    if (!result.error) router.refresh();
  }

  return <button onClick={remove} className="text-xs text-danger hover:underline">제거</button>;
}

export function AssignGroupMemberForm({
  groupId,
  members,
  disabled,
}: {
  groupId: string;
  members: Profile[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function assign(formData: FormData) {
    setPending(true);
    setError(undefined);
    const result = await assignGroupMember(groupId, String(formData.get("user_id") ?? ""));
    setPending(false);
    if (result.error) return setError(result.error);
    router.refresh();
  }

  if (disabled) return <p className="text-sm text-gray-500">정원이 찼습니다. 정원을 늘린 후 배정하세요.</p>;
  if (members.length === 0) return <p className="text-sm text-gray-500">배정 가능한 승인 회원이 없습니다.</p>;

  return (
    <form action={assign} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <Select name="user_id" label="회원" defaultValue="" required>
        <option value="" disabled>회원 선택</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name || "(이름 없음)"}{member.nickname ? ` (${member.nickname})` : ""}
            {member.student_no ? ` · ${member.student_no}` : ""}
          </option>
        ))}
      </Select>
      <Button type="submit" variant="primary" disabled={pending} className="shrink-0">
        {pending ? "배정 중..." : "배정"}
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </form>
  );
}
