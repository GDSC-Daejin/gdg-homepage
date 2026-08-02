import { describe, expect, it } from "vitest";
import { mapDeployment } from "@/lib/vercel";

const sample = {
  deployments: [
    {
      created: 1690000000000,
      state: "READY",
      meta: {
        githubCommitMessage: "feat: 배포 위젯",
        githubCommitAuthorName: "jieunsse",
      },
    },
  ],
};

describe("mapDeployment", () => {
  it("최신 배포를 정규화한다", () => {
    expect(mapDeployment(sample)).toEqual({
      state: "READY",
      createdAt: 1690000000000,
      commitMessage: "feat: 배포 위젯",
      commitAuthor: "jieunsse",
    });
  });

  it("배포가 없거나 잘못된 입력이면 null", () => {
    expect(mapDeployment({ deployments: [] })).toBeNull();
    expect(mapDeployment(null)).toBeNull();
    expect(mapDeployment({})).toBeNull();
  });

  it("meta·state 누락 시 안전한 기본값", () => {
    const result = mapDeployment({
      deployments: [{ readyState: "BUILDING", created: 1 }],
    });
    expect(result).toMatchObject({
      state: "BUILDING",
      commitAuthor: "",
      commitMessage: "",
    });
  });
});
