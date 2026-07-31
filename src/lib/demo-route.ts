/** 레코드 id 한 칸 — uuid이거나 예시 데이터의 "demo-…" id. */
const RECORD_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 둘러보기 모드를 켜고 끌 때 머물러도 되는 경로.
 * 예시 데이터와 실제 데이터는 id가 서로 없어서 상세 화면에 그대로 있으면 404가 난다 —
 * /admin/groups/<id> → /admin/groups 처럼 id 앞에서 잘라 목록으로 돌려보낸다.
 */
export function safeDemoPath(pathname: string): string {
  const parts = pathname.split("/");
  const index = parts.findIndex((part) => RECORD_SEGMENT.test(part) || part.startsWith("demo-"));
  if (index === -1) return pathname;
  return parts.slice(0, index).join("/") || "/";
}
