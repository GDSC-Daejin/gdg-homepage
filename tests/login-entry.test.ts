import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );

  return paths.flat().filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));
}

describe("로그인 진입점", () => {
  it("루트 랜딩에서 Google 로그인을 제공하고 이전 /login 경로를 참조하지 않는다", async () => {
    const landing = await readFile("src/app/landing-preview/Landing.tsx", "utf8");
    const files = await sourceFiles("src");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));

    expect(landing).toContain('import { GoogleLoginButton } from "./GoogleLoginButton"');
    expect(landing).toContain("<GoogleLoginButton");
    expect(sources.join("\n")).not.toContain("/login");
  });
});
