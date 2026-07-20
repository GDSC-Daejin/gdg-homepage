// dev 브랜치 push 시 커밋을 운영진 친화적으로 정제해 Slack에 전송.
// GitHub Actions에서 실행. 외부 의존성 없음(Node 20 내장 fetch 사용).
//
// ponytail: 접두사→카테고리 매핑까지만 코드로 정제한다. 커밋 "설명 문장" 자체의
// 개발 용어는 그대로 통과한다(평문 재작성은 LLM 없이는 불가). 품질을 더 높이려면
// 커밋 메시지를 사용자 관점으로 쓰거나, 이 자리에 요약 모델을 붙이는 게 업그레이드 경로.

const BUCKETS = {
  feat: { label: "✨ 새 기능", order: 1 },
  fix: { label: "🐛 버그 수정", order: 2 },
  docs: { label: "📝 문서", order: 3 },
  other: { label: "📌 기타 변경", order: 4 },
  internal: { label: "🔧 내부 개선", order: 5 },
};

// conventional-commit 타입 → 버킷
const CONV_TYPE = {
  feat: "feat",
  fix: "fix",
  docs: "docs",
  refactor: "internal",
  chore: "internal",
  test: "internal",
  style: "internal",
  ci: "internal",
  build: "internal",
  perf: "internal",
  revert: "internal",
};

// 선두 emoji → 버킷
const EMOJI_TYPE = {
  "✨": "feat",
  "🎸": "feat",
  "🚀": "feat",
  "🐛": "fix",
  "🚑": "fix",
  "🩹": "fix",
  "📝": "docs",
  "📚": "docs",
  "📄": "docs",
  "♻️": "internal",
  "🔧": "internal",
  "🎨": "internal",
  "✅": "internal",
  "🔨": "internal",
  "⚡": "internal",
};

const CONV_RE = /^(\w+)(?:\([^)]*\))?!?:\s*(.*)$/;

// 선두 emoji 하나를 떼고 [emoji, 나머지] 반환. 없으면 [null, 원문].
function stripLeadingEmoji(text) {
  for (const emoji of Object.keys(EMOJI_TYPE)) {
    if (text.startsWith(emoji)) {
      return [emoji, text.slice(emoji.length).trim()];
    }
  }
  return [null, text];
}

// 커밋 첫 줄 → { bucket, description }. null이면 알림에서 제외.
export function classifyCommit(message) {
  const subject = (message ?? "").split("\n")[0].trim();
  if (!subject || /^Merge\b/.test(subject)) return null;

  let bucket = null;
  let text = subject;

  const [emoji, afterEmoji] = stripLeadingEmoji(subject);
  if (emoji) {
    bucket = EMOJI_TYPE[emoji];
    text = afterEmoji;
  }

  // emoji 뒤(또는 처음)에 conventional 접두사가 있으면 그걸로 버킷/설명 확정
  const conv = text.match(CONV_RE);
  if (conv && CONV_TYPE[conv[1].toLowerCase()]) {
    bucket = CONV_TYPE[conv[1].toLowerCase()];
    text = conv[2].trim();
  }

  if (!bucket) bucket = "other";
  if (!text) return null;
  return { bucket, description: text };
}

// 커밋 배열 → Slack text. 표시할 게 없으면 null.
export function buildSlackMessage(commits, compareUrl) {
  const groups = {};
  let count = 0;

  for (const c of commits ?? []) {
    const classified = classifyCommit(c?.message);
    if (!classified) continue;
    (groups[classified.bucket] ??= []).push(classified.description);
    count += 1;
  }

  if (count === 0) return null;

  const lines = [`🚀 dev 업데이트 (${count}건)`];

  const order = Object.keys(BUCKETS).sort(
    (a, b) => BUCKETS[a].order - BUCKETS[b].order,
  );
  for (const bucket of order) {
    const items = groups[bucket];
    if (!items?.length) continue;
    lines.push("", BUCKETS[bucket].label);
    for (const item of items) lines.push(`• ${item}`);
  }

  if (compareUrl) lines.push("", `▸ 자세히 보기: ${compareUrl}`);
  return lines.join("\n");
}

async function main() {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("SLACK_WEBHOOK_URL이 설정되지 않았어요.");
    process.exit(1);
  }

  let commits = [];
  try {
    commits = JSON.parse(process.env.COMMITS_JSON ?? "[]");
  } catch {
    console.error("COMMITS_JSON 파싱 실패");
    process.exit(1);
  }

  const text = buildSlackMessage(commits, process.env.COMPARE_URL);
  if (!text) {
    console.log("알릴 커밋이 없어 건너뜁니다.");
    return;
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    console.error(`Slack 전송 실패: ${res.status}`);
    process.exit(1);
  }
  console.log("Slack 전송 완료");
}

// 직접 실행될 때만 전송(테스트 import 시엔 실행 안 됨)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
