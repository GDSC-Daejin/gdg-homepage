import { readdir, readFile } from "node:fs/promises";

const DIR = "supabase/migrations";

const migrations = (async () => {
  const names = (await readdir(DIR)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(names.map(async (name) => ({ name, sql: await readFile(`${DIR}/${name}`, "utf8") })));
})();

/**
 * 마이그레이션 전체에서 이 함수의 **살아있는** 정의를 돌려준다.
 *
 * 함수는 `create or replace`로 덮어써지므로 번호가 가장 큰 파일의 정의가 실제로 도는 정의다.
 * 테스트가 파일 번호를 박아두면 다음 재정의 뒤에도 죽은 사본을 검사하며 조용히 통과한다 —
 * 랭킹전 규칙 테스트가 0082가 살아있는데 0078·0080을 보고 있었다.
 *
 * 이름만 받는다. 같은 이름에 다른 시그니처를 둔 함수가 없어서 이름이 유일한 키다.
 */
export async function latestFunction(name: string): Promise<string> {
  const header = new RegExp(String.raw`create (?:or replace )?function public\.${name}\s*\(`, "g");
  let body: string | null = null;

  for (const { name: file, sql } of await migrations) {
    for (const match of sql.matchAll(header)) {
      const start = match.index;
      const open = sql.indexOf("as $$", start);
      const close = sql.indexOf("$$;", open);
      if (open === -1 || close === -1) throw new Error(`${file}의 ${name} 정의가 as $$ … $$; 형태가 아니다`);
      body = sql.slice(start, close + "$$;".length);
    }
  }

  if (body === null) throw new Error(`마이그레이션에 함수 ${name} 정의가 없다`);
  return body;
}
