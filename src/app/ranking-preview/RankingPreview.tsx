"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/wds/Button";
import { ContentBadge, SegmentedControl } from "@/components/wds/primitives";
import type { RankingBattleSummary, RankingLeagueState } from "@/lib/pokedex/ranking-league";
import {
  RANKING_ATTACKS_PER_DAY,
  RANKING_START_RATING,
  battleDelta,
  gapToPodium,
  rankingRecord,
  rankingScoreSeries,
  recentDefense,
  rewardProgress,
  seasonProgress,
  signedScore,
  timeUntilRefresh,
} from "@/lib/pokedex/ranking-stats";
import { Glyph, type GlyphName, Pips, PokemonImage, ScoreChart, Sprite, TONE, medalStyle } from "./parts";
import {
  ME_LABEL,
  OWNED_POKEMON,
  PREVIEW_EXTRA,
  PREVIEW_PROFILE_ID,
  PREVIEW_STATE,
  REROLLED_OPPONENTS,
  RULES,
  TODAY,
  UNADOPTED,
  displayName,
  pokemonOf,
  seasonRange,
  sumPower,
} from "./preview-data";

type TabKey = "home" | "attack" | "deck" | "log";
type DeckKind = "attack" | "defense";

const TABS: { key: TabKey; label: string; short: string; icon: GlyphName }[] = [
  { key: "home", label: "랭킹전 홈", short: "홈", icon: "home" },
  { key: "attack", label: "공격", short: "공격", icon: "fire" },
  { key: "deck", label: "내 덱", short: "내 덱", icon: "deck" },
  { key: "log", label: "기록", short: "기록", icon: "rank" },
];

const DECK_LABEL: Record<DeckKind, string> = { defense: "방어 덱", attack: "공격 덱" };
const dark = (alpha: number) => `rgba(247,247,248,${alpha})`;
const presetKey = (kind: DeckKind, slot: number) => `${kind}-${slot}`;

/** 서비스의 toggleRankingPresetMember와 같은 규칙 — 3마리가 차면 더 담기지 않는다. */
function togglePresetMember(throwIds: string[], throwId: string) {
  if (throwIds.includes(throwId)) return throwIds.filter((id) => id !== throwId);
  return throwIds.length === 3 ? throwIds : [...throwIds, throwId];
}

/** 다음 상대 갱신(매일 06:00 KST)까지 남은 시간. 서버 렌더와 어긋나지 않게 마운트 후에 채운다. */
function useNextRefresh() {
  const [text, setText] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setText(timeUntilRefresh(Date.now()));
    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, []);
  return text;
}

export function RankingPreview() {
  const [tab, setTab] = useState<TabKey>("home");
  const [presets, setPresets] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(PREVIEW_STATE.presets.map((preset) => [presetKey(preset.kind, preset.slot), preset.members.map((member) => member.throwId)])),
  );
  const [slots, setSlots] = useState<Record<DeckKind, number>>({ defense: 1, attack: 1 });
  const [editing, setEditing] = useState<DeckKind>("defense");
  const [activeDefenseSlot, setActiveDefenseSlot] = useState<number | null>(PREVIEW_STATE.entry?.activeDefenseSlot ?? null);
  const [saved, setSaved] = useState<string>();
  const [attacksUsed, setAttacksUsed] = useState(PREVIEW_STATE.entry?.attacksToday ?? 0);
  const [rerolled, setRerolled] = useState(false);
  const [opponents, setOpponents] = useState<RankingLeagueState["opponents"]>(PREVIEW_STATE.opponents);
  const [log, setLog] = useState<RankingBattleSummary[]>(PREVIEW_STATE.battles);
  const [logFilter, setLogFilter] = useState("all");
  const [moreHome, setMoreHome] = useState(false);
  const [moreLog, setMoreLog] = useState(false);
  /** 이 화면에서 새로 치른 전투만 누적한다 — 시작값은 PREVIEW_STATE.entry가 갖고 있다. */
  const [session, setSession] = useState({ delta: 0, wins: 0, matches: 0 });

  const refreshIn = useNextRefresh();
  const season = useMemo(() => seasonProgress(PREVIEW_STATE.season, TODAY), []);
  const rating = (PREVIEW_STATE.entry?.rating ?? RANKING_START_RATING) + session.delta;
  const attacksLeft = RANKING_ATTACKS_PER_DAY - attacksUsed;
  const wins = (PREVIEW_STATE.entry?.wins ?? 0) + session.wins;
  const matches = (PREVIEW_STATE.entry?.matches ?? 0) + session.matches;
  const myRank = PREVIEW_STATE.entry?.rank ?? null;
  const record = rankingRecord(log, PREVIEW_PROFILE_ID);
  const defense = recentDefense(log, PREVIEW_PROFILE_ID, TODAY);
  const reward = rewardProgress({ ...PREVIEW_STATE.entry!, matches, wins });
  const podiumGap = gapToPodium(PREVIEW_STATE.leaderboard, rating, myRank);
  const earned = rating - RANKING_START_RATING;

  const attackDeck = presets[presetKey("attack", slots.attack)] ?? [];
  const defenseDeck = presets[presetKey("defense", slots.defense)] ?? [];
  const editingDeck = editing === "attack" ? attackDeck : defenseDeck;
  const ace = pokemonOf(attackDeck[0]) ?? OWNED_POKEMON[0];

  function setDeck(kind: DeckKind, next: string[]) {
    setPresets((current) => ({ ...current, [presetKey(kind, slots[kind])]: next }));
    setSaved(undefined);
  }

  function attack(allocationId: string) {
    const opponent = opponents.find((item) => item.allocationId === allocationId);
    const read = PREVIEW_EXTRA.opponentReads.find((item) => item.allocationId === allocationId);
    if (!opponent || attacksLeft <= 0) return;
    const win = read?.verdict !== "불리";
    const delta = win ? 30 : -30;
    setAttacksUsed((count) => count + 1);
    setSession((current) => ({ delta: current.delta + delta, wins: current.wins + (win ? 1 : 0), matches: current.matches + 1 }));
    setLog((current) => [
      {
        id: `session-${current.length}`,
        role: "attacker",
        opponentName: opponent.name,
        opponentNickname: opponent.nickname,
        winnerId: win ? PREVIEW_PROFILE_ID : opponent.allocationId,
        attackerDelta: delta,
        defenderDelta: -delta / 3,
        createdAt: new Date(TODAY).toISOString(),
      },
      ...current,
    ]);
  }

  const filteredLog = log.filter((item) => logFilter === "all" || item.role === logFilter);
  const series = rankingScoreSeries(log, rating).map((point) => point.rating);

  return (
    <div className="rp">
      <header className="rp-topbar">
        <div className="rp-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
            <span className="rp-brand">도감 랭킹전</span>
            <nav className="rp-tabs" aria-label="랭킹전 페이지">
              {TABS.map((item) => (
                <button key={item.key} type="button" className="rp-tab" aria-current={tab === item.key ? "page" : undefined} onClick={() => setTab(item.key)}>
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="rp-mutedark">이번 시즌 · D-{season.daysLeft}</span>
            <span className="rp-scorechip">
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--rp-dark-primary)" }}>{myRank}위</span>
              <span className="rp-num" style={{ fontSize: 12, fontWeight: 700, color: "var(--rp-on-dark)" }}>{rating.toLocaleString()}점</span>
            </span>
          </div>
        </div>
      </header>

      {tab === "home" && (
        <>
          <section className="rp-hero">
            <div className="rp-inner">
              <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="rp-tierchip">시즌 D-{season.daysLeft}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: dark(0.75) }}>{ME_LABEL}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: dark(0.5) }}>내 점수</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span className="rp-heroscore" style={{ color: "var(--rp-on-dark)" }}>{rating.toLocaleString()}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: dark(0.5) }}>점</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--rp-dark-primary)", letterSpacing: "-0.03em" }}>{myRank}위</span>
                    <span style={{ width: 3, height: 3, borderRadius: 999, background: dark(0.3) }} />
                    <span style={{ fontSize: 12, color: dark(0.55) }}>{wins}승 {matches - wins}패</span>
                  </div>
                </div>
                <div className="rp-attackbox">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--rp-on-dark)" }}>오늘 남은 공격</span>
                    <span className="rp-num" style={{ fontSize: 12.5, fontWeight: 800, color: "var(--rp-dark-primary)" }}>{attacksLeft}/{RANKING_ATTACKS_PER_DAY}</span>
                  </div>
                  <Pips left={attacksLeft} total={RANKING_ATTACKS_PER_DAY} dark />
                  <span style={{ fontSize: 11, color: dark(0.45) }}>다음 갱신까지 {refreshIn}</span>
                </div>
              </div>

              <div className="rp-party">
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: dark(0.4) }}>MY PARTY</span>
                <div className="rp-partyrow">
                  {attackDeck.map((throwId) => {
                    const pokemon = pokemonOf(throwId);
                    if (!pokemon) return null;
                    return (
                      <div key={throwId} className="rp-partyslot">
                        <div className="rp-stage">
                          <PokemonImage src={pokemon.imagePath} size={104} alt={pokemon.name} />
                        </div>
                        <div className="rp-nameplate">
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--rp-on-dark)", letterSpacing: "-0.02em" }}>{pokemon.name}</span>
                          <span className="rp-num" style={{ fontSize: 11, fontWeight: 600, color: "var(--rp-dark-primary)" }}>전투력 {pokemon.combatPower}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 2, flexWrap: "wrap", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: dark(0.5) }}>공격 덱 · 합산 전투력 {sumPower(attackDeck).toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: dark(0.3) }}>|</span>
                  <span style={{ fontSize: 12, color: dark(0.5) }}>공격 {record.attack.wins}승 {record.attack.losses}패</span>
                </div>
              </div>

              <div className="rp-todaycard">
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "var(--rp-dark-primary)" }}>TODAY</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "var(--rp-on-dark)", letterSpacing: "-0.03em" }}>도전할 상대 {opponents.length}명</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {opponents.map((opponent) => (
                    <div key={opponent.allocationId} className="rp-todayface">
                      <PokemonImage src={opponent.lead.imagePath} size={48} alt={opponent.lead.name} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: dark(0.8) }}>{opponent.lead.name}</span>
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: dark(0.6), lineHeight: 1.5 }}>{RULES.reveal} · 유리한 상대부터 고르면 점수를 더 벌어요</span>
                <Button size="large" fullWidth disabled={attacksLeft === 0} onClick={() => setTab("attack")}>
                  {attacksLeft === 0 ? "오늘 공격을 다 썼어요" : "상대 고르러 가기"}
                </Button>
              </div>
            </div>
          </section>

          <main className="rp-inner rp-page">
            <div className="rp-grid2">
              <div className="rp-card rp-card--warn rp-actioncard">
                <div style={{ display: "flex", gap: 4, flex: "none" }}>
                  {[0, 1, 2].map((index) => {
                    const pokemon = pokemonOf(defenseDeck[index]);
                    return pokemon
                      ? <PokemonImage key={index} src={pokemon.imagePath} size={52} alt={pokemon.name} style={{ borderRadius: 12, background: "var(--wds-primary-bg)" }} />
                      : <span key={index} style={{ width: 52, height: 52, borderRadius: 12, border: "1px dashed rgba(112,115,124,.30)", background: "var(--wds-fill-alternative)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "var(--wds-label-assistive)" }}>+</span>;
                  })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.025em" }}>
                      {activeDefenseSlot ? `방어 덱 ${activeDefenseSlot}번이 켜져 있어요` : "방어 덱이 비어 있어요"}
                    </span>
                    <ContentBadge size="xsmall" color={activeDefenseSlot ? "green" : "orange"}>{activeDefenseSlot ? "활성" : "미설정"}</ContentBadge>
                  </div>
                  <span style={{ fontSize: 12.5, color: "var(--wds-label-alternative)", lineHeight: 1.5 }}>
                    {activeDefenseSlot ? RULES.defenseDelay : `${RULES.noDefense} · 지금 활성화하면 내일 ${RULES.refreshAt}부터 막아줘요`}
                  </span>
                </div>
                <Button size="medium" variant="outlined" color="assistive" onClick={() => { setTab("deck"); setEditing("defense"); }}>덱 짜러 가기</Button>
              </div>

              <div className="rp-card rp-actioncard">
                <span style={{ width: 56, height: 56, borderRadius: 14, background: defense && defense.delta >= 0 ? "rgba(0,191,64,.10)" : "rgba(255,66,66,.10)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <Sprite no={26} size={44} alt="" />
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.025em" }}>
                      {defense ? `최근 24시간 방어 ${defense.wins}승 ${defense.losses}패` : "아직 방어 기록이 없어요"}
                    </span>
                    {defense && <ContentBadge size="xsmall" color={defense.delta >= 0 ? "green" : "red"}>{signedScore(defense.delta)}점</ContentBadge>}
                  </div>
                  <span style={{ fontSize: 12.5, color: "var(--wds-label-alternative)", lineHeight: 1.5 }}>
                    {defense ? "자는 동안 치러진 방어전이에요 · 기록에서 다시 볼 수 있어요" : "방어 덱을 켜면 자는 동안에도 점수를 지켜요"}
                  </span>
                </div>
                <Button size="medium" variant="text" color="assistive" onClick={() => setTab("log")}>기록 보기</Button>
              </div>
            </div>

            {/* 티어 대신 시즌 진행률만 둔다 — 랭킹전은 1,000점에서 시작하는 점수제 하나뿐이다. */}
            <div className="rp-card" style={{ gap: 18, padding: "22px 24px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="rp-cardtitle">시즌 진행</span>
                  <span className="rp-cardsub">{seasonRange(PREVIEW_STATE.season)} · {season.daysLeft}일 남음</span>
                </div>
                <ContentBadge size="small" color="primary">{season.percent}% 진행</ContentBadge>
              </div>
              <div className="rp-bar" style={{ height: 8 }} role="progressbar" aria-label="시즌 진행" aria-valuenow={season.percent} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${season.percent}%`, background: "var(--wds-primary)" }} />
              </div>
              <div className="rp-grid2">
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, border: "1px solid var(--wds-line-alternative)" }}>
                  <PokemonImage src={ace.imagePath} size={44} alt={ace.name} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>지금 {rating.toLocaleString()}점 · {myRank}위</span>
                    <span className="rp-num" style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>
                      시즌 시작({RANKING_START_RATING.toLocaleString()}점) 대비 {signedScore(earned)}점 · {podiumGap === null ? "3위 안에 있어요" : `3위까지 ${podiumGap}점`}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: 14, borderRadius: 12, border: "1px solid var(--wds-line-alternative)" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>시즌 보상</span>
                  <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)", lineHeight: 1.5 }}>1~3위는 영구 트로피와 프로필 뱃지를 받아요</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--wds-primary-heavy)" }}>
                    {reward.eligible ? "보상 조건을 채웠어요" : `조건까지 ${[reward.matchesLeft && `${reward.matchesLeft}전`, reward.attacksLeft && `공격 ${reward.attacksLeft}회`].filter(Boolean).join(" · ")} 남음`}
                  </span>
                </div>
              </div>
            </div>

            <div className="rp-grid2" style={{ alignItems: "start" }}>
              <div className="rp-card">
                <div className="rp-cardhead">
                  <span className="rp-cardtitle">시즌 랭킹</span>
                  <Button size="xsmall" variant="text" color="assistive" onClick={() => setTab("log")}>전체 보기</Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {PREVIEW_STATE.leaderboard.map((member, index) => (
                    <div key={member.rank} className="rp-rankrow">
                      <span style={medalStyle(member.rank)}>{member.rank}</span>
                      <Sprite no={[6, 26, 38][index]} size={46} alt="" />
                      <span className="rp-truncate" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.015em" }}>{displayName(member.name, member.nickname)}</span>
                      <span className="rp-num" style={{ fontSize: 15, fontWeight: 800 }}>{member.rating.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="rp-rankrow rp-rankrow--me">
                    <span style={{ fontSize: 12, fontWeight: 800, textAlign: "center" }}>{myRank}</span>
                    <PokemonImage src={ace.imagePath} size={46} alt={ace.name} />
                    <span className="rp-truncate" style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.015em" }}>{ME_LABEL}</span>
                    <span className="rp-num" style={{ fontSize: 15, fontWeight: 800 }}>{rating.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="rp-card">
                <div className="rp-cardhead">
                  <span className="rp-cardtitle">동아리 소식</span>
                  <Button size="xsmall" variant="text" color="assistive" onClick={() => setTab("log")}>전체 보기</Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {PREVIEW_EXTRA.feed.map((item) => (
                    <div key={`${item.who}-${item.time}`} className="rp-feedrow">
                      <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--wds-fill-alternative)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <Sprite no={item.no} size={34} alt="" />
                      </span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, flex: 1, minWidth: 0 }}>
                        <b style={{ fontWeight: 700 }}>{item.who}</b>
                        <span style={{ color: "var(--wds-label-alternative)" }}>님이 </span>
                        <b style={{ fontWeight: 700 }}>{item.whom}</b>
                        <span style={{ color: "var(--wds-label-alternative)" }}>님을 이겼어요</span>
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", color: item.win ? TONE.pos.fg : TONE.neg.fg }}>{item.note}</span>
                      <span style={{ fontSize: 11, color: "var(--wds-label-assistive)", whiteSpace: "nowrap" }}>{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rp-onlymobile">
              {moreHome && (
                <div className="rp-card">
                  <div className="rp-cardhead">
                    <span className="rp-cardtitle">내 점수 추이</span>
                    <span className="rp-num" style={{ fontSize: 12, fontWeight: 800, color: earned >= 0 ? TONE.pos.fg : TONE.neg.fg }}>{signedScore(earned)}</span>
                  </div>
                  <ScoreChart values={series} height={96} grid={1} />
                </div>
              )}
              <Button size="medium" variant="text" color="assistive" fullWidth onClick={() => setMoreHome((value) => !value)}>
                {moreHome ? "접기" : "점수 추이 더보기"}
              </Button>
            </div>
          </main>
        </>
      )}

      {tab === "attack" && (
        <main className="rp-inner rp-page">
          <div className="rp-pagehead">
            <div>
              <h1 className="rp-title">오늘의 상대</h1>
              <p className="rp-lede">{RULES.reveal} · 매일 {RULES.refreshAt}에 새로 뽑혀요</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--wds-label-neutral)" }}>남은 공격 {attacksLeft}/{RANKING_ATTACKS_PER_DAY}</span>
                <Pips left={attacksLeft} total={RANKING_ATTACKS_PER_DAY} />
              </div>
              <Button
                variant="outlined"
                color="assistive"
                size="small"
                disabled={rerolled || attacksUsed > 0}
                onClick={() => { setRerolled(true); setOpponents(REROLLED_OPPONENTS); }}
              >
                상대 리롤 ({rerolled ? 0 : 1}/1)
              </Button>
            </div>
          </div>

          <div className="rp-card rp-deckbar">
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "none" }}>
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>내 공격 덱 {slots.attack}번</span>
              <span className="rp-num" style={{ fontSize: 11.5, color: "var(--wds-label-alternative)", whiteSpace: "nowrap" }}>
                합산 전투력 {sumPower(attackDeck).toLocaleString()} · 공격 {record.attack.wins}승 {record.attack.losses}패
              </span>
            </div>
            <div style={{ width: 1, height: 44, background: "var(--wds-line-alternative)" }} className="rp-desktoponly" />
            <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
              {attackDeck.map((throwId, index) => {
                const pokemon = pokemonOf(throwId);
                if (!pokemon) return null;
                return (
                  <div key={throwId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 10px", borderRadius: 12, background: "var(--wds-primary-bg)" }}>
                    <span style={{ width: 19, height: 19, borderRadius: 999, background: "var(--wds-primary)", color: "var(--wds-static-white)", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{index + 1}</span>
                    <PokemonImage src={pokemon.imagePath} size={38} alt={pokemon.name} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{pokemon.name}</span>
                      <span className="rp-num" style={{ fontSize: 11, fontWeight: 600, color: "var(--wds-primary-heavy)" }}>{pokemon.combatPower}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button size="small" variant="outlined" color="assistive" onClick={() => { setTab("deck"); setEditing("attack"); }}>덱 바꾸기</Button>
          </div>

          <div className="rp-grid3">
            {opponents.map((opponent, index) => {
              const read = PREVIEW_EXTRA.opponentReads[index];
              const tone = TONE[read.tone];
              return (
                <div key={opponent.allocationId} className="rp-oppcard">
                  <div className="rp-oppstrip" style={{ color: tone.fg, background: tone.bg }}>{read.verdictLong}</div>
                  <div className="rp-oppbody">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <span className="rp-truncate" style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.025em" }}>{displayName(opponent.name, opponent.nickname)}</span>
                        <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>방어 승률 {read.defenseWinRate}%</span>
                      </div>
                      <ContentBadge size="xsmall" variant="outlined" color={read.tone === "pos" ? "green" : read.tone === "neg" ? "red" : "neutral"}>{read.verdict}</ContentBadge>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--wds-label-neutral)" }}>상대 방어 덱</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div className="rp-oppslot">
                          <PokemonImage src={opponent.lead.imagePath} size={46} alt={opponent.lead.name} />
                          <span style={{ fontSize: 10.5, fontWeight: 700 }}>선봉</span>
                        </div>
                        {[1, 2].map((slot) => (
                          <div key={slot} className="rp-oppslot rp-oppslot--hidden">
                            <span style={{ fontSize: 20, fontWeight: 800 }}>?</span>
                            <span style={{ fontSize: 10.5 }}>미공개</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>합산 전투력</span>
                        <span className="rp-num" style={{ fontSize: 14, fontWeight: 700 }}>
                          {opponent.powerFloor.toLocaleString()}~{(opponent.powerFloor + 999).toLocaleString()}
                        </span>
                      </div>
                      <div className="rp-bar"><span style={{ width: `${read.power}%`, background: tone.dot }} /></div>
                    </div>

                    <div style={{ padding: "9px 11px", borderRadius: 10, background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 600, lineHeight: 1.45 }}>{read.hint}</div>

                    <Button size="large" fullWidth disabled={attacksLeft === 0 || attackDeck.length !== 3} onClick={() => attack(opponent.allocationId)} style={{ marginTop: "auto" }}>
                      {attacksLeft === 0 ? "공격 소진" : attackDeck.length !== 3 ? "공격 덱 3마리 필요" : "공격하기"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 12, background: "var(--wds-fill-alternative)" }}>
            <span style={{ fontSize: 13, color: "var(--wds-label-neutral)", lineHeight: 1.55 }}>
              공격에서 이기면 30점을 얻고 지면 30점을 잃어요. 결과는 바로 점수에 반영되고 <b style={{ fontWeight: 700 }}>기록</b> 탭에서 다시 볼 수 있어요.
            </span>
          </div>
        </main>
      )}

      {tab === "deck" && (
        <main className="rp-inner rp-page">
          <div className="rp-pagehead">
            <div>
              <h1 className="rp-title">내 덱</h1>
              <p className="rp-lede">방어 덱은 다음 날 {RULES.refreshAt}부터, 공격 덱은 저장 즉시 적용돼요</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {saved && <ContentBadge size="small" color="green">{saved}</ContentBadge>}
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--wds-primary-heavy)", padding: "7px 12px", borderRadius: 999, background: "var(--wds-primary-bg)" }}>
                {DECK_LABEL[editing]}을 편집 중이에요
              </span>
              <Button
                size="small"
                disabled={editingDeck.length !== 3}
                onClick={() => {
                  if (editing === "defense") {
                    setActiveDefenseSlot(slots.defense);
                    setSaved(`방어 덱 ${slots.defense}번 활성화 · 내일 ${RULES.refreshAt}부터`);
                  } else {
                    setSaved(`공격 덱 ${slots.attack}번 저장 완료`);
                  }
                }}
              >
                {editing === "defense" ? "방어 덱으로 활성화" : "공격 덱 저장"}
              </Button>
            </div>
          </div>

          <div className="rp-grid2">
            {(["defense", "attack"] as DeckKind[]).map((kind) => {
              const deck = kind === "attack" ? attackDeck : defenseDeck;
              const active = editing === kind;
              const isActiveDefense = kind === "defense" && activeDefenseSlot === slots.defense;
              return (
                <div
                  key={kind}
                  className="rp-card"
                  style={{
                    padding: 20,
                    gap: 16,
                    borderColor: active ? "rgba(0,102,255,.35)" : undefined,
                    boxShadow: active ? "0 1px 4px rgba(0,102,255,.10)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.025em", whiteSpace: "nowrap" }}>{DECK_LABEL[kind]}</span>
                      {kind === "defense"
                        ? <ContentBadge size="xsmall" color={isActiveDefense ? "green" : "orange"}>{isActiveDefense ? "활성" : "미활성"}</ContentBadge>
                        : <ContentBadge size="xsmall" color="green">사용 중</ContentBadge>}
                      {!active && <Button size="xsmall" variant="text" color="assistive" onClick={() => setEditing(kind)}>이 덱 편집</Button>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>프리셋</span>
                      {[1, 2, 3].map((slot) => (
                        <Button
                          key={slot}
                          size="xsmall"
                          round
                          variant={slots[kind] === slot ? "solid" : "outlined"}
                          color="assistive"
                          onClick={() => { setSlots((current) => ({ ...current, [kind]: slot })); setEditing(kind); setSaved(undefined); }}
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="rp-slots">
                    {[0, 1, 2].map((index) => {
                      const pokemon = pokemonOf(deck[index]);
                      if (!pokemon) return <div key={index} className="rp-slot rp-slot--empty"><span style={{ fontSize: 18 }}>+</span></div>;
                      return (
                        <button key={pokemon.throwId} type="button" className="rp-slot" onClick={() => setDeck(kind, deck.filter((id) => id !== pokemon.throwId))}>
                          <span className="rp-order">{index + 1}</span>
                          <PokemonImage src={pokemon.imagePath} size={52} alt={pokemon.name} />
                          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{pokemon.name}</span>
                          <span className="rp-num" style={{ fontSize: 11, fontWeight: 600, color: "var(--wds-primary-heavy)" }}>{pokemon.combatPower}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2, gap: 8 }}>
                    <span className="rp-num" style={{ fontSize: 12, color: "var(--wds-label-alternative)" }}>합산 {sumPower(deck).toLocaleString()}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wds-label-neutral)" }}>
                      {kind === "defense"
                        ? `방어 ${record.defense.wins}승 ${record.defense.losses}패`
                        : `공격 ${record.attack.wins}승 ${record.attack.losses}패`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rp-rule" />

          <div className="rp-split rp-split--deck">
            <div className="rp-card">
              <div className="rp-cardhead">
                <div>
                  <span className="rp-cardtitle">보유 포켓몬 {OWNED_POKEMON.length}</span>
                  <p className="rp-cardsub">누르면 {DECK_LABEL[editing]}에 넣어요 — 3마리까지</p>
                </div>
                <div className="rp-decktabs">
                  <SegmentedControl
                    size="small"
                    items={[{ key: "defense", label: DECK_LABEL.defense }, { key: "attack", label: DECK_LABEL.attack }]}
                    value={editing}
                    onChange={(key) => setEditing(key as DeckKind)}
                  />
                </div>
              </div>
              <div className="rp-grid6">
                {OWNED_POKEMON.map((pokemon) => {
                  const order = editingDeck.indexOf(pokemon.throwId);
                  return (
                    <button
                      key={pokemon.throwId}
                      type="button"
                      className="rp-pick"
                      aria-pressed={order >= 0}
                      onClick={() => setDeck(editing, togglePresetMember(editingDeck, pokemon.throwId))}
                    >
                      {order >= 0 && <span className="rp-order">{order + 1}</span>}
                      <PokemonImage src={pokemon.imagePath} size={56} alt={pokemon.name} style={{ opacity: order >= 0 ? 1 : 0.5 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{pokemon.name}</span>
                      <span className="rp-num" style={{ fontSize: 11, color: "var(--wds-label-alternative)" }}>전투력 {pokemon.combatPower}</span>
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)", lineHeight: 1.5 }}>{RULES.presetRule}</span>
            </div>

            <div className="rp-card">
              <div>
                <span className="rp-cardtitle">추천 조합</span>
                <p className="rp-cardsub">최근 상대들의 타입을 보고 골랐어요</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {PREVIEW_EXTRA.recommendations.map((recommendation) => (
                  <div key={recommendation.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, border: "1px solid var(--wds-line-alternative)" }}>
                    <div style={{ display: "flex", gap: 2, flex: "none" }}>
                      {recommendation.members.map((throwId) => {
                        const pokemon = pokemonOf(throwId);
                        return pokemon ? <PokemonImage key={throwId} src={pokemon.imagePath} size={36} alt={pokemon.name} /> : null;
                      })}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{recommendation.title}</span>
                      <span className="rp-num" style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>
                        합산 {sumPower(recommendation.members).toLocaleString()} · {recommendation.note}
                      </span>
                    </div>
                    <Button size="xsmall" variant="outlined" color="assistive" onClick={() => setDeck(editing, recommendation.members)}>적용</Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {tab === "log" && (
        <main className="rp-inner rp-page">
          <div className="rp-pagehead">
            <div>
              <h1 className="rp-title">전투 기록</h1>
              <p className="rp-lede">최근 30일 · 시즌이 끝나면 초기화돼요</p>
            </div>
            <SegmentedControl
              style={{ width: 240 }}
              items={[{ key: "all", label: "전체" }, { key: "atk", label: "공격" }, { key: "def", label: "방어" }]}
              value={logFilter}
              onChange={setLogFilter}
            />
          </div>

          <div className="rp-split rp-split--log">
            <div className="rp-card">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span className="rp-cardtitle">점수 변화</span>
                  <p className="rp-cardsub">시즌 시작 이후</p>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                    <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>최고</span>
                    <span className="rp-num" style={{ fontSize: 14, fontWeight: 800 }}>{Math.max(...series).toLocaleString()}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                    <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>시즌 시작 대비</span>
                    <span className="rp-num" style={{ fontSize: 14, fontWeight: 800, color: earned >= 0 ? TONE.pos.fg : TONE.neg.fg }}>
                      {signedScore(earned)}
                    </span>
                  </div>
                </div>
              </div>
              <ScoreChart values={series} height={180} grid={3} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "var(--wds-label-assistive)" }}>시즌 시작</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wds-primary)" }}>지금</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateRows: "repeat(4, 1fr)", gap: 12 }}>
              <div className="rp-statrow">
                <span style={{ fontSize: 12.5, color: "var(--wds-label-alternative)" }}>이번 시즌 전적</span>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{wins}승 {matches - wins}패</span>
              </div>
              <div className="rp-statrow">
                <span style={{ fontSize: 12.5, color: "var(--wds-label-alternative)" }}>획득 점수</span>
                <span className="rp-num" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: earned >= 0 ? TONE.pos.fg : TONE.neg.fg }}>
                  {signedScore(earned)}
                </span>
              </div>
              <div className="rp-statrow">
                <span style={{ fontSize: 12.5, color: "var(--wds-label-alternative)" }}>최고 연승</span>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{record.bestStreak}연승</span>
              </div>
              <div className="rp-statrow">
                <span style={{ fontSize: 12.5, color: "var(--wds-label-alternative)" }}>방어 승률</span>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: TONE.pos.fg }}>
                  {record.defenseWinRate === null ? "–" : `${record.defenseWinRate}%`}
                </span>
              </div>
            </div>
          </div>

          <div className="rp-card rp-card--flush">
            {filteredLog.length === 0
              ? <p style={{ padding: "16px 0", fontSize: 13, color: "var(--wds-label-alternative)" }}>해당하는 기록이 없어요.</p>
              : filteredLog.map((item) => {
                const win = item.winnerId === PREVIEW_PROFILE_ID;
                const attack = item.role === "attacker";
                return (
                  <div key={item.id} className="rp-logrow">
                    <span className="rp-chip" style={{ background: win ? "rgba(0,191,64,.12)" : "rgba(255,66,66,.10)", color: win ? TONE.pos.fg : TONE.neg.fg }}>
                      {win ? "승" : "패"}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span
                          className="rp-kindchip"
                          style={{
                            background: attack ? "rgba(0,102,255,.10)" : "rgba(112,115,124,.10)",
                            color: attack ? "var(--wds-primary-heavy)" : "var(--wds-label-neutral)",
                          }}
                        >
                          {attack ? "공격" : "방어"}
                        </span>
                        <span className="rp-truncate" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>{displayName(item.opponentName, item.opponentNickname)}</span>
                      </div>
                      <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>
                        {new Date(item.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
                      </span>
                    </div>
                    <span className="rp-num" style={{ fontSize: 14, fontWeight: 800, color: win ? TONE.pos.fg : TONE.neg.fg }}>{signedScore(battleDelta(item))}</span>
                    <Button size="xsmall" variant="text" color="assistive" className="rp-desktoponly">상세</Button>
                  </div>
                );
              })}
          </div>

          <div className="rp-rule rp-desktoponly" />

          <div className="rp-section rp-desktoponly">
            <div className="rp-sectionhead">
              <h2 className="rp-sectiontitle">기록에서 보이는 것</h2>
              <span className="rp-sectionnote">다음 덱을 짤 때 참고해요</span>
            </div>
            <div className="rp-grid2">
              <div className="rp-card">
                <div>
                  <span className="rp-cardtitle">내 포켓몬별 승률</span>
                  <p className="rp-cardsub">출전 횟수 3회 이상</p>
                </div>
                <WinRateList />
              </div>
              <div className="rp-card">
                <div>
                  <span className="rp-cardtitle">라이벌 상대전적</span>
                  <p className="rp-cardsub">두 번 이상 붙은 트레이너</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {PREVIEW_EXTRA.rivals.map((rival) => {
                    const edge = rival.wins === rival.losses ? "neu" : rival.wins > rival.losses ? "pos" : "neg";
                    return (
                      <div key={rival.no} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: "1px solid var(--wds-line-alternative)" }}>
                        <Sprite no={rival.no} size={42} alt="" />
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                          <span className="rp-truncate" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em" }}>{rival.name}</span>
                          <span style={{ fontSize: 11.5, color: "var(--wds-label-alternative)" }}>선봉 {rival.lead}</span>
                        </div>
                        <span className="rp-num" style={{ fontSize: 13.5, fontWeight: 800 }}>{rival.wins}승 {rival.losses}패</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: TONE[edge].bg, color: TONE[edge].fg }}>
                          {edge === "pos" ? "우세" : edge === "neg" ? "열세" : "호각"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rp-onlymobile">
            {moreLog && (
              <div className="rp-card">
                <span className="rp-cardtitle">내 포켓몬별 승률</span>
                <WinRateList compact />
              </div>
            )}
            <Button size="medium" variant="text" color="assistive" fullWidth onClick={() => setMoreLog((value) => !value)}>
              {moreLog ? "접기" : "포켓몬별 승률 더보기"}
            </Button>
          </div>
        </main>
      )}

      <nav className="rp-bottomnav" aria-label="랭킹전 페이지">
        {TABS.map((item) => (
          <button key={item.key} type="button" aria-current={tab === item.key ? "page" : undefined} onClick={() => setTab(item.key)}>
            <Glyph name={item.icon} size={22} />
            <span>{item.short}</span>
          </button>
        ))}
      </nav>

      <footer className="rp-inner" style={{ paddingBottom: 32, display: "flex", flexDirection: "column", gap: 6 }}>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--wds-label-assistive)", lineHeight: 1.6 }}>
          도감 랭킹전 리디자인 시안 · 실제 데이터가 아닌 미리보기 화면이에요.
        </p>
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--wds-label-assistive)", lineHeight: 1.6 }}>
          <b style={{ fontWeight: 700 }}>미채택</b> — {UNADOPTED.join(" · ")}
        </p>
      </footer>
    </div>
  );
}

function WinRateList({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {PREVIEW_EXTRA.winRates.map((item) => {
        const percent = Math.round((item.wins / (item.wins + item.losses)) * 100);
        return (
          <div key={item.no} style={{ display: "grid", gridTemplateColumns: compact ? "34px 58px minmax(0,1fr) 40px" : "40px 74px minmax(0,1fr) 92px", gap: 12, alignItems: "center" }}>
            <Sprite no={item.no} size={compact ? 34 : 40} alt="" />
            <span style={{ fontSize: compact ? 12 : 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{item.name}</span>
            <div className="rp-bar" style={{ height: 8 }}>
              <span style={{ width: `${percent}%`, background: percent >= 60 ? "var(--wds-status-positive)" : percent >= 45 ? "var(--wds-primary)" : "rgba(112,115,124,.45)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
              <span className="rp-num" style={{ fontSize: 13, fontWeight: 800 }}>{percent}%</span>
              {!compact && <span style={{ fontSize: 11, color: "var(--wds-label-alternative)", whiteSpace: "nowrap" }}>{item.wins}승 {item.losses}패</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
