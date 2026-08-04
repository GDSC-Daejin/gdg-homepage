"use client";

import Link from "next/link";
import { useState } from "react";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import {
  RANKING_ATTACKS_PER_DAY,
  RANKING_START_RATING,
  gapToPodium,
  rankingRecord,
  rankingScoreSeries,
  recentDefense,
  rewardProgress,
  seasonProgress,
  signedScore,
} from "@/lib/pokedex/ranking-stats";
import { PokemonImage, Pips, ScoreChart, TONE, medalStyle, onHero, useRefreshCountdown } from "./parts";

function displayName(name: string, nickname: string | null) {
  return nickname ? `${name} (${nickname})` : name;
}

const seasonDate = (value: string) => new Date(value).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

export function HomeScreen({ profileId, state }: { profileId: string; state: RankingLeagueState }) {
  const entry = state.entry!;
  const [moreHome, setMoreHome] = useState(false);
  const refreshIn = useRefreshCountdown();

  const now = Date.now();
  const season = seasonProgress(state.season, now);
  const record = rankingRecord(state.battles, profileId);
  const series = rankingScoreSeries(state.battles, entry.rating).map((point) => point.rating);
  const defense = recentDefense(state.battles, profileId, now);
  const reward = rewardProgress(entry);
  const podiumGap = gapToPodium(state.leaderboard, entry.rating, entry.rank);
  const attacksLeft = Math.max(0, RANKING_ATTACKS_PER_DAY - entry.attacksToday);
  const earned = entry.rating - RANKING_START_RATING;
  const inTopBoard = state.leaderboard.some((member) => member.userId === profileId);

  // 마이 파티 = 활성 공격 프리셋. 아직 고르지 않았으면 1번을 보여준다.
  const attackSlot = entry.activeAttackSlot ?? 1;
  const party = state.presets.find((preset) => preset.kind === "attack" && preset.slot === attackSlot)?.members ?? [];
  const ace = party[0] ?? state.ownedPokemon[0];
  const partyPower = party.reduce((total, pokemon) => total + pokemon.combatPower, 0);
  const defenseReady = entry.activeDefenseSlot !== null;

  return (
    <>
      <section className="rk-hero">
        <div className="rk-inner">
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="rk-tierchip">시즌 D-{season.daysLeft}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: onHero(0.75) }}>내 기록</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: onHero(0.5) }}>내 점수</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="rk-heroscore" style={{ color: "var(--rk-on-hero)" }}>{entry.rating.toLocaleString()}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: onHero(0.5) }}>점</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
                {entry.rank !== null && <span style={{ fontSize: 20, fontWeight: 800, color: "var(--rk-hero-primary)", letterSpacing: "-0.03em" }}>{entry.rank}위</span>}
                <span style={{ width: 3, height: 3, borderRadius: 999, background: onHero(0.3) }} />
                <span style={{ fontSize: 12, color: onHero(0.55) }}>{entry.wins}승 {entry.matches - entry.wins}패</span>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: onHero(0.3) }} />
                <span style={{ fontSize: 12, color: onHero(0.55) }}>시즌 시작 대비 {signedScore(earned)}점</span>
              </div>
            </div>
            <div className="rk-attackbox">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--rk-on-hero)" }}>오늘 남은 공격</span>
                <span className="rk-num" style={{ fontSize: 12.5, fontWeight: 800, color: "var(--rk-hero-primary)" }}>{attacksLeft}/{RANKING_ATTACKS_PER_DAY}</span>
              </div>
              <Pips left={attacksLeft} total={RANKING_ATTACKS_PER_DAY} hero />
              <span style={{ fontSize: 11, color: onHero(0.45) }}>다음 갱신까지 {refreshIn}</span>
            </div>
          </div>

          <div className="rk-party">
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: onHero(0.4) }}>MY PARTY</span>
            {party.length === 3 ? (
              <>
                <div className="rk-partyrow">
                  {party.map((pokemon) => (
                    <div key={pokemon.throwId} className="rk-partyslot">
                      <div className="rk-stage"><PokemonImage src={pokemon.imagePath} size={104} alt={pokemon.name} /></div>
                      <div className="rk-nameplate">
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--rk-on-hero)", letterSpacing: "-0.02em" }}>{pokemon.name}</span>
                        <span className="rk-num" style={{ fontSize: 11, fontWeight: 600, color: "var(--rk-hero-primary)" }}>전투력 {pokemon.combatPower}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 2, flexWrap: "wrap", justifyContent: "center" }}>
                  <span style={{ fontSize: 12, color: onHero(0.5) }}>공격 덱 {attackSlot}번 · 합산 전투력 {partyPower.toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: onHero(0.3) }}>|</span>
                  <span style={{ fontSize: 12, color: onHero(0.5) }}>공격 {record.attack.wins}승 {record.attack.losses}패</span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
                <div className="rk-partyrow">
                  {[0, 1, 2].map((index) => (
                    <span key={index} className="rk-stage" style={{ borderRadius: 16, border: `1px dashed ${onHero(0.25)}`, color: onHero(0.4), fontSize: 22, alignItems: "center" }}>+</span>
                  ))}
                </div>
                <span style={{ fontSize: 12.5, color: onHero(0.6) }}>공격 덱을 3마리로 채우면 여기 올라와요</span>
                <Link href="/pokedex/ranking/deck" className="rk-herolink">덱 짜러 가기</Link>
              </div>
            )}
          </div>

          <div className="rk-todaycard">
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "var(--rk-hero-primary)" }}>TODAY</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "var(--rk-on-hero)", letterSpacing: "-0.03em" }}>
                {state.opponents.length ? `도전할 상대 ${state.opponents.length}명` : "배정된 상대가 없어요"}
              </span>
            </div>
            {state.opponents.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                {state.opponents.map((opponent) => (
                  <div key={opponent.allocationId} className="rk-todayface">
                    <PokemonImage src={opponent.lead.imagePath} size={48} alt={opponent.lead.name} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: onHero(0.8) }}>{opponent.lead.name}</span>
                  </div>
                ))}
              </div>
            )}
            <span style={{ fontSize: 11.5, color: onHero(0.6), lineHeight: 1.5 }}>
              선봉 한 마리와 합산 전투력 천 단위만 공개돼요 · 나머지 두 마리는 공개되지 않아요
            </span>
            <Link
              href="/pokedex/ranking/attack"
              className="rk-cta"
              aria-disabled={attacksLeft === 0 || state.opponents.length === 0}
            >
              {attacksLeft === 0 ? "오늘 공격을 다 썼어요" : "상대 고르러 가기"}
            </Link>
          </div>
        </div>
      </section>

      <main className="rk-inner rk-page">
        <div className="rk-grid2">
          <div className={`rk-card rk-actioncard${defenseReady ? "" : " rk-card--warn"}`}>
            <div style={{ display: "flex", gap: 4, flex: "none" }}>
              {[0, 1, 2].map((index) => {
                const pokemon = state.presets.find((preset) => preset.kind === "defense" && preset.slot === entry.activeDefenseSlot)?.members[index];
                return pokemon
                  ? <PokemonImage key={index} src={pokemon.imagePath} size={52} alt={pokemon.name} style={{ borderRadius: 12, background: "var(--rk-primary-bg)" }} />
                  : <span key={index} style={{ width: 52, height: 52, borderRadius: 12, border: "1px dashed var(--rk-line)", background: "var(--rk-fill-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "var(--rk-text-3)" }}>+</span>;
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.025em" }}>
                  {defenseReady ? `방어 덱 ${entry.activeDefenseSlot}번이 켜져 있어요` : "방어 덱이 비어 있어요"}
                </span>
                <span className={`rk-badge ${defenseReady ? "rk-badge--pos" : "rk-badge--warn"}`}>{defenseReady ? "활성" : "미설정"}</span>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--rk-text-2)", lineHeight: 1.5 }}>
                {defenseReady
                  ? "바꾸면 다음 날 06:00부터 매칭에 반영돼요"
                  : "비워두면 다른 트레이너가 그냥 이겨요 · 지금 활성화하면 내일 06:00부터 막아줘요"}
              </span>
            </div>
            <Link href="/pokedex/ranking/deck" className="rk-link">덱 짜러 가기</Link>
          </div>

          <div className="rk-card rk-actioncard">
            <span style={{ width: 56, height: 56, borderRadius: 14, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: defense && defense.delta >= 0 ? TONE.positive.bg : TONE.negative.bg }}>
              <PokemonImage src={ace?.imagePath ?? ""} size={44} alt="" />
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.025em" }}>
                  {defense ? `최근 24시간 방어 ${defense.wins}승 ${defense.losses}패` : "아직 방어 기록이 없어요"}
                </span>
                {defense && <span className={`rk-badge ${defense.delta >= 0 ? "rk-badge--pos" : "rk-badge--neg"}`}>{signedScore(defense.delta)}점</span>}
              </div>
              <span style={{ fontSize: 12.5, color: "var(--rk-text-2)", lineHeight: 1.5 }}>
                {defense ? "자는 동안 치러진 방어전이에요" : "방어 덱을 켜면 자는 동안에도 점수를 지켜요"}
              </span>
            </div>
            <Link href="/pokedex/ranking/log" className="rk-link">기록 보기</Link>
          </div>
        </div>

        <div className="rk-card" style={{ gap: 18, padding: "22px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span className="rk-cardtitle">시즌 진행</span>
              <span className="rk-cardsub">{seasonDate(state.season.startsAt)} – {seasonDate(state.season.endsAt)} · {season.daysLeft}일 남음</span>
            </div>
            <span className="rk-badge rk-badge--primary">{season.percent}% 진행</span>
          </div>
          <div className="rk-bar" style={{ height: 8 }} role="progressbar" aria-label="시즌 진행" aria-valuenow={season.percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${season.percent}%`, background: "var(--rk-primary)" }} />
          </div>
          <div className="rk-grid2">
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, border: "1px solid var(--rk-line-soft)" }}>
              {ace && <PokemonImage src={ace.imagePath} size={44} alt={ace.name} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>지금 {entry.rating.toLocaleString()}점{entry.rank !== null ? ` · ${entry.rank}위` : ""}</span>
                <span className="rk-num" style={{ fontSize: 11.5, color: "var(--rk-text-2)" }}>
                  시즌은 모두 {RANKING_START_RATING.toLocaleString()}점에서 시작해요 · {podiumGap === null ? "3위 안에 있어요" : `3위까지 ${podiumGap}점`}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: 14, borderRadius: 12, border: "1px solid var(--rk-line-soft)" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>시즌 보상</span>
              <span style={{ fontSize: 11.5, color: "var(--rk-text-2)", lineHeight: 1.5 }}>1~3위는 영구 트로피와 프로필 뱃지를 받아요</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--rk-primary-heavy)" }}>
                {reward.eligible
                  ? "보상 조건을 채웠어요"
                  : `조건까지 ${[reward.matchesLeft && `${reward.matchesLeft}전`, reward.attacksLeft && `공격 ${reward.attacksLeft}회`].filter(Boolean).join(" · ")} 남음`}
              </span>
            </div>
          </div>
        </div>

        <div className="rk-card">
          <div className="rk-cardhead">
            <span className="rk-cardtitle">시즌 랭킹</span>
            <Link href="/pokedex/ranking/log" className="rk-link">전체 보기</Link>
          </div>
          {state.leaderboard.length === 0 ? (
            <p className="rk-cardsub">아직 참가자가 없어요.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {state.leaderboard.slice(0, 3).map((member) => (
                <div key={member.userId} className={`rk-rankrow${member.userId === profileId ? " rk-rankrow--me" : ""}`} aria-current={member.userId === profileId ? "true" : undefined}>
                  <span style={medalStyle(member.rank)}>{member.rank}</span>
                  <span className="rk-truncate" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.015em" }}>{displayName(member.name, member.nickname)}</span>
                  <span className="rk-num" style={{ fontSize: 15, fontWeight: 800 }}>{member.rating.toLocaleString()}</span>
                </div>
              ))}
              {!inTopBoard && (
                <div className="rk-rankrow rk-rankrow--me" aria-current="true">
                  <span style={{ fontSize: 12, fontWeight: 800, textAlign: "center" }}>{entry.rank ?? "–"}</span>
                  <span className="rk-truncate" style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: "-0.015em" }}>내 순위</span>
                  <span className="rk-num" style={{ fontSize: 15, fontWeight: 800 }}>{entry.rating.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rk-onlymobile">
          {moreHome && (
            <div className="rk-card">
              <div className="rk-cardhead">
                <span className="rk-cardtitle">내 점수 추이</span>
                <span className="rk-num" style={{ fontSize: 12, fontWeight: 800, color: earned >= 0 ? TONE.positive.fg : TONE.negative.fg }}>{signedScore(earned)}</span>
              </div>
              <ScoreChart values={series} height={96} grid={1} />
            </div>
          )}
          <button type="button" className="rk-morebtn" onClick={() => setMoreHome((value) => !value)}>
            {moreHome ? "접기" : "점수 추이 더보기"}
          </button>
        </div>
      </main>
    </>
  );
}
