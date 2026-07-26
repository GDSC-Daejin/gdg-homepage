// dev 브랜치 push 시 커밋을 운영진 친화적으로 정제해 Slack에 전송.
// GitHub Actions에서 실행. 외부 의존성 없음(Node 20 내장 fetch 사용).
//
// ponytail: 접두사→카테고리 매핑까지만 코드로 정제한다. 커밋 "설명 문장" 자체의
// 개발 용어는 그대로 통과한다(평문 재작성은 LLM 없이는 불가). 품질을 더 높이려면
// 커밋 메시지를 사용자 관점으로 쓰거나, 이 자리에 요약 모델을 붙이는 게 업그레이드 경로.
//
// 채널이 밀리지 않게 하루 한 글만 만들고 그날의 나머지 푸시는 그 스레드에 붙인다.
// 웹훅은 ts를 안 돌려줘서 스레드를 못 달기 때문에 봇 토큰(chat.postMessage)을 쓴다.
// ponytail: "오늘의 부모 글"은 저장소를 두지 않고 채널 히스토리에서 찾는다.
// 하루 푸시 수십 건 규모라 한 번의 history 조회로 충분하다.

const SLACK_API = "https://slack.com/api";
const HEADER = "🚀 dev 업데이트";
// 슬랙은 저장할 때 이모지를 콜론 코드로 바꾼다 — 보낸 건 "🚀"여도 히스토리엔 ":rocket:"으로 온다.
// 그래서 부모를 찾을 땐 둘 다 받아준다(이걸 놓치면 매 푸시가 새 글로 올라간다).
const HEADER_RE = /^(?:🚀|:rocket:)\s*dev 업데이트/;

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

  const lines = [`${HEADER} (${count}건)`];

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

async function slackCall(method, body, token) {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  return res.json();
}

/** KST 기준 오늘 0시의 epoch(초). 슬랙 ts와 같은 단위다. */
export function kstDayStart(now = new Date()) {
  const today = now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return Math.floor(new Date(`${today}T00:00:00+09:00`).getTime() / 1000);
}

/**
 * 오늘 채널에 올린 첫 dev 업데이트 글(스레드 부모)의 ts. 없으면 null.
 * conversations.history는 최신순이라 뒤에서 꺼내야 그날의 첫 글이다.
 * 답글이 달린 부모는 thread_ts가 자기 ts와 같게 채워지므로 그 경우도 부모로 인정한다
 * (아니면 첫 답글 이후 부모를 못 찾아 매번 새 글이 생긴다).
 */
export function pickTodayParentTs(messages) {
  const parents = (messages ?? []).filter(
    (m) =>
      m.bot_id &&
      HEADER_RE.test(m.text ?? "") &&
      (!m.thread_ts || m.thread_ts === m.ts),
  );
  return parents.length ? parents[parents.length - 1].ts : null;
}

async function findTodayParentTs(token, channel) {
  const res = await slackCall(
    "conversations.history",
    { channel, oldest: String(kstDayStart()), limit: 200 },
    token,
  );
  // 조회에 실패하면(권한 누락 등) 스레드를 포기하고 새 글로 올린다 — 알림 자체를 놓치지 않는 게 우선이다
  if (!res.ok) {
    console.warn(`오늘 스레드를 찾지 못했어요(${res.error}). 새 글로 올립니다.`);
    return null;
  }
  return pickTodayParentTs(res.messages);
}

async function main() {
  const token = process.env.SLACK_JARVIS_BOT_TOKEN;
  const channel = process.env.SLACK_DEV_CHANNEL_ID;
  if (!token || !channel) {
    console.error("SLACK_JARVIS_BOT_TOKEN 또는 SLACK_DEV_CHANNEL_ID가 설정되지 않았어요.");
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

  const threadTs = await findTodayParentTs(token, channel);
  const res = await slackCall(
    "chat.postMessage",
    { channel, text, ...(threadTs ? { thread_ts: threadTs } : {}) },
    token,
  );
  if (!res.ok) {
    console.error(`Slack 전송 실패: ${res.error}`);
    process.exit(1);
  }
  console.log(threadTs ? "Slack 전송 완료 (오늘 스레드에 댓글)" : "Slack 전송 완료 (오늘 첫 글)");
}

// 직접 실행될 때만 전송(테스트 import 시엔 실행 안 됨)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
