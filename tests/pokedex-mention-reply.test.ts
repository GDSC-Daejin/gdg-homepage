import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMentionReply, findPokemonByName, MENTION_USAGE } from "@/lib/pokedex/mention-reply";
import { RARITY_PROBABILITY, catchRatePercent, type PokemonProbabilityRow } from "@/lib/pokedex/probability";
import { claimSlackEvent, shouldProcessMention } from "@/app/api/slack/pokedex/events/helpers";

const CATALOG: PokemonProbabilityRow[] = [
  { pokedex_no: 25, name_ko: "피카츄", rarity: "uncommon", spawn_weight: 55, catch_rate: 0.6 },
  { pokedex_no: 133, name_ko: "이브이", rarity: "rare", spawn_weight: 25, catch_rate: 0.48 },
  { pokedex_no: 134, name_ko: "샤미드", rarity: "very_rare", spawn_weight: 12, catch_rate: 0.36 },
  { pokedex_no: 150, name_ko: "뮤츠", rarity: "legendary", spawn_weight: 8, catch_rate: 0.28 },
  { pokedex_no: 151, name_ko: "뮤", rarity: "legendary", spawn_weight: 8, catch_rate: 0.28 },
];

describe("멘션에서 포켓몬 이름 찾기", () => {
  it("정확한 이름, 띄어쓰기, 조사가 붙은 이름을 찾는다", () => {
    expect(findPokemonByName("<@UBOT> 샤미드 포획률 알려줘", CATALOG)?.name_ko).toBe("샤미드");
    expect(findPokemonByName("<@UBOT> 샤 미드 포획률", CATALOG)?.name_ko).toBe("샤미드");
    expect(findPokemonByName("<@UBOT> 피카츄의 포획률은?", CATALOG)?.name_ko).toBe("피카츄");
  });
  it("긴 이름을 먼저 찾아 뮤츠를 뮤로 오인하지 않는다", () => {
    expect(findPokemonByName("뮤츠 포획률", CATALOG)?.name_ko).toBe("뮤츠");
  });
  it("없는 이름은 null이다", () => {
    expect(findPokemonByName("<@UBOT> 없는몬 포획률", CATALOG)).toBeNull();
  });
});

describe("멘션 답변", () => {
  it("샤미드 예시 답변이 웹 확률표 계산과 같은 숫자를 쓴다", () => {
    const reply = buildMentionReply("<@UBOT> 샤미드 포획률 알려줘", CATALOG);
    console.log(reply);
    expect(reply).toContain("*샤미드*");
    expect(reply).toContain(RARITY_PROBABILITY.very_rare.label);
    expect(reply).toContain(`${catchRatePercent(0.36)}%`);
    expect(reply).toContain(`${RARITY_PROBABILITY.very_rare.catchRate}%`);
    expect(reply).toContain("출현 가중치: 12");
  });
  it("없는 이름이지만 비슷하면 제안한다", () => {
    expect(buildMentionReply("피카추 포획률", CATALOG)).toContain("*피카츄*");
  });
  it("전혀 다른 이름이면 사용법을 안내한다", () => {
    expect(buildMentionReply("없는몬 포획률", CATALOG)).toContain(MENTION_USAGE);
  });
  it("포획률 질문이 아니면 사용법을 답한다", () => {
    expect(buildMentionReply("안녕", CATALOG)).toBe(MENTION_USAGE);
  });
});

describe("멘션 이벤트 필터와 중복 방지", () => {
  const base = { type: "app_mention", user: "U1", channel: "C1", ts: "1.1", text: "x" };
  it("사람이 한 멘션만 처리하고 봇·부가 이벤트는 무시한다", () => {
    expect(shouldProcessMention(base)).toBe(true);
    expect(shouldProcessMention({ ...base, bot_id: "B1" })).toBe(false);
    expect(shouldProcessMention({ ...base, subtype: "message_changed" })).toBe(false);
    expect(shouldProcessMention({ ...base, type: "reaction_added" })).toBe(false);
  });
  it("같은 event_id는 한 번만 선점한다", async () => {
    const seen = new Set<string>();
    const store = { from: () => ({ insert: async ({ event_id }: { event_id: string }) => { if (seen.has(event_id)) return { error: {} }; seen.add(event_id); return { error: null }; } }) };
    await expect(claimSlackEvent(store, "Ev1")).resolves.toBe(true);
    await expect(claimSlackEvent(store, "Ev1")).resolves.toBe(false);
  });
});

describe("이벤트 경로 분기", () => {
  const afterMock = vi.fn((fn: () => unknown) => { void fn(); });
  const reaction = vi.fn();
  const mention = vi.fn();
  const original = process.env.POKEDEX_SLACK_SIGNING_SECRET;

  function signed(payload: object) {
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const hmac = createHmac("sha256", "pokedex-secret");
    hmac.update(`v0:${timestamp}:${rawBody}`);
    return new Request("https://example.com/api/slack/pokedex/events", { method: "POST", headers: { "x-slack-request-timestamp": timestamp, "x-slack-signature": `v0=${hmac.digest("hex")}` }, body: rawBody });
  }

  beforeEach(() => {
    process.env.POKEDEX_SLACK_SIGNING_SECRET = "pokedex-secret";
    vi.resetModules();
    reaction.mockClear(); mention.mockClear();
    vi.doMock("next/server", () => ({ after: afterMock }));
    vi.doMock("@/app/api/slack/pokedex/events/mention", () => ({ handleMention: mention.mockResolvedValue(undefined) }));
    vi.doMock("@/app/api/slack/pokedex/events/helpers", async (orig) => {
      const actual = await orig<typeof import("@/app/api/slack/pokedex/events/helpers")>();
      return { ...actual, shouldProcess: (e: unknown) => { reaction(e); return false; } };
    });
  });
  afterEach(() => {
    vi.doUnmock("next/server"); vi.doUnmock("@/app/api/slack/pokedex/events/mention"); vi.doUnmock("@/app/api/slack/pokedex/events/helpers");
    if (original === undefined) delete process.env.POKEDEX_SLACK_SIGNING_SECRET; else process.env.POKEDEX_SLACK_SIGNING_SECRET = original;
  });

  it("app_mention은 멘션 처리기로, reaction_added는 리액션 처리기로 보낸다", async () => {
    process.env.POKEDEX_SLACK_BOT_TOKEN = "xoxb-test";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    const { POST } = await import("@/app/api/slack/pokedex/events/route");
    await POST(signed({ event_id: "Ev1", event: { type: "app_mention", user: "U1", text: "x", channel: "C", ts: "1" } }));
    await POST(signed({ event_id: "Ev2", event: { type: "reaction_added", user: "U1", reaction: "pokeball", item: { ts: "1" } } }));
    await new Promise((r) => setTimeout(r, 20));
    expect(mention).toHaveBeenCalledTimes(1);
    expect(reaction).toHaveBeenCalledTimes(1);
  });
  it("그 밖의 이벤트는 둘 다 호출하지 않는다", async () => {
    const { POST } = await import("@/app/api/slack/pokedex/events/route");
    const res = await POST(signed({ event_id: "Ev3", event: { type: "message", user: "U1" } }));
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 20));
    expect(mention).not.toHaveBeenCalled();
    expect(reaction).not.toHaveBeenCalled();
  });
});
