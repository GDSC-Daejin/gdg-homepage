import "server-only";

export type Deployment = {
  state: string; // READY | BUILDING | ERROR | QUEUED | CANCELED ...
  createdAt: number; // epoch ms
  commitMessage: string;
  commitAuthor: string;
};

// 이름에 VERCEL_ 프리픽스 금지 — Vercel이 예약해 프로덕션 env로 등록 불가
const token = process.env.VC_TOKEN;
const projectId = process.env.VC_PROJECT_ID;
const teamId = process.env.VC_TEAM_ID; // 팀 프로젝트일 때만

// 배포 목록 JSON에서 최신 배포 1건을 정규화. 없으면 null.
export function mapDeployment(json: unknown): Deployment | null {
  const list = (json as { deployments?: unknown[] } | null)?.deployments;
  const first = Array.isArray(list) ? list[0] : undefined;
  if (!first) return null;

  const d = first as {
    created?: number;
    state?: string;
    readyState?: string;
    meta?: {
      githubCommitMessage?: string;
      githubCommitAuthorName?: string;
    };
  };

  return {
    state: d.state ?? d.readyState ?? "UNKNOWN",
    createdAt: Number(d.created ?? 0),
    commitMessage: d.meta?.githubCommitMessage ?? "",
    commitAuthor: d.meta?.githubCommitAuthorName ?? "",
  };
}

export async function getLatestDeployment(): Promise<Deployment | null> {
  if (!token || !projectId) return null;

  const params = new URLSearchParams({
    projectId,
    target: "production",
    limit: "1",
  });
  if (teamId) params.set("teamId", teamId);

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?${params}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) return null;
    return mapDeployment(await res.json());
  } catch {
    return null;
  }
}
