import type { GroupStatus, GroupType } from "@/lib/types";

export interface GroupInput {
  type: GroupType;
  title: string;
  description: string;
  season: string;
  status: GroupStatus;
  capacity: number | null;
}

const TYPES: GroupType[] = ["study", "project"];
const STATUSES: GroupStatus[] = ["recruiting", "active", "archived"];

export function parseGroupForm(
  formData: FormData,
): { data: GroupInput; error?: string } {
  const type = String(formData.get("type") ?? "") as GroupType;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const season = String(formData.get("season") ?? "").trim();
  const status = String(formData.get("status") ?? "recruiting") as GroupStatus;
  const capRaw = String(formData.get("capacity") ?? "").trim();
  const data: GroupInput = {
    type,
    title,
    description,
    season,
    status,
    capacity: null,
  };

  if (!TYPES.includes(type)) return { data, error: "종류가 올바르지 않습니다" };
  if (!title) return { data, error: "제목을 입력해주세요" };
  if (!season) return { data, error: "기수를 입력해주세요" };
  if (!STATUSES.includes(status)) return { data, error: "상태가 올바르지 않습니다" };
  if (capRaw !== "") {
    const capacity = Number(capRaw);
    if (!Number.isInteger(capacity) || capacity < 1) {
      return { data, error: "정원은 1 이상이어야 합니다" };
    }
    data.capacity = capacity;
  }
  return { data };
}
