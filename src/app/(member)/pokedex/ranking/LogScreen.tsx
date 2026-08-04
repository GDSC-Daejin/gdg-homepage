"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { getRankingBattleDetail } from "@/actions/pokedex-ranking";
import type { RankingBattleDetail, RankingBattleRole, RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { RANKING_START_RATING, battleDelta, rankingRecord, rankingScoreSeries, signedScore } from "@/lib/pokedex/ranking-stats";
import { RankingBattleAnimation } from "../RankingBattleAnimation";
import { ScoreChart, TONE } from "./parts";

function displayName(name: string, nickname: string | null) {
  return nickname ? `${name} (${nickname})` : name;
}

const FILTERS: { key: "all" | RankingBattleRole; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "attacker", label: "공격" },
  { key: "defender", label: "방어" },
];

export function LogScreen({ profileId, state }: { profileId: string; state: RankingLeagueState }) {
  const entry = state.entry!;
  const [filter, setFilter] = useState<"all" | RankingBattleRole>("all");
  const [battle, setBattle] = useState<RankingBattleDetail>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const record = rankingRecord(state.battles, profileId);
  const series = rankingScoreSeries(state.battles, entry.rating).map((point) => point.rating);
  const earned = entry.rating - RANKING_START_RATING;
  const battles = state.battles.filter((item) => filter === "all" || item.role === filter);

  function open(battleId: string) {
    setError(undefined);
    startTransition(async () => {
      const result = await getRankingBattleDetail(battleId);
      if (result.error) setError(result.error);
      if (result.battle) setBattle(result.battle);
    });
  }

  return (
    <main className="rk-inner rk-page">
      <div className="rk-pagehead">
        <div>
          <h1 className="rk-title">전투 기록</h1>
          <p className="rk-lede">최근 30일 · 시즌이 끝나면 초기화돼요</p>
        </div>
        <div role="group" aria-label="기록 필터" className="rk-segment">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rk-split rk-split--log">
        <div className="rk-card">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <span className="rk-cardtitle">점수 변화</span>
              <p className="rk-cardsub">시즌 시작 이후</p>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11.5, color: "var(--rk-text-2)" }}>최고</span>
                <span className="rk-num" style={{ fontSize: 14, fontWeight: 800 }}>{Math.max(...series).toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11.5, color: "var(--rk-text-2)" }}>시즌 시작 대비</span>
                <span className="rk-num" style={{ fontSize: 14, fontWeight: 800, color: earned >= 0 ? TONE.positive.fg : TONE.negative.fg }}>{signedScore(earned)}</span>
              </div>
            </div>
          </div>
          <ScoreChart values={series} height={180} grid={3} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--rk-text-3)" }}>시즌 시작</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--rk-primary)" }}>지금</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "repeat(4, 1fr)", gap: 12 }}>
          <div className="rk-statrow">
            <span style={{ fontSize: 12.5, color: "var(--rk-text-2)" }}>이번 시즌 전적</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{entry.wins}승 {entry.matches - entry.wins}패</span>
          </div>
          <div className="rk-statrow">
            <span style={{ fontSize: 12.5, color: "var(--rk-text-2)" }}>획득 점수</span>
            <span className="rk-num" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: earned >= 0 ? TONE.positive.fg : TONE.negative.fg }}>{signedScore(earned)}</span>
          </div>
          <div className="rk-statrow">
            <span style={{ fontSize: 12.5, color: "var(--rk-text-2)" }}>최고 연승</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{record.bestStreak}연승</span>
          </div>
          <div className="rk-statrow">
            <span style={{ fontSize: 12.5, color: "var(--rk-text-2)" }}>방어 승률</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: TONE.positive.fg }}>
              {record.defenseWinRate === null ? "–" : `${record.defenseWinRate}%`}
            </span>
          </div>
        </div>
      </div>

      <div className="rk-card rk-card--flush">
        {battles.length === 0 ? (
          <p style={{ padding: "16px 0", fontSize: 13, color: "var(--rk-text-2)" }}>
            {state.battles.length === 0 ? "아직 랭킹전 기록이 없어요." : "해당하는 기록이 없어요."}
          </p>
        ) : battles.map((item) => {
          const won = item.winnerId === profileId;
          const attack = item.role === "attacker";
          return (
            <div key={item.id} className="rk-logrow">
              <span className="rk-chip" style={{ background: won ? TONE.positive.bg : TONE.negative.bg, color: won ? TONE.positive.fg : TONE.negative.fg }}>
                {won ? "승" : "패"}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span className="rk-kindchip" style={{ background: attack ? "var(--rk-primary-bg)" : "var(--rk-fill)", color: attack ? "var(--rk-primary-heavy)" : "var(--rk-text-1)" }}>
                    {attack ? "공격" : "방어"}
                  </span>
                  <span className="rk-truncate" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.015em" }}>
                    {displayName(item.opponentName, item.opponentNickname)}
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: "var(--rk-text-2)" }}>
                  {new Date(item.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <span className="rk-num" style={{ fontSize: 14, fontWeight: 800, color: won ? TONE.positive.fg : TONE.negative.fg }}>{signedScore(battleDelta(item))}</span>
              <button type="button" className="rk-link" disabled={pending} onClick={() => open(item.id)}>상세</button>
            </div>
          );
        })}
      </div>

      {error && <p role="alert" style={{ fontSize: 13, color: "var(--rk-neg-fg)" }}>{error}</p>}

      {battle && (
        <Modal open onClose={() => setBattle(undefined)} ariaLabel="랭킹전 전투 기록" className="max-w-[96rem] p-8">
          <RankingBattleAnimation battle={battle} profileId={profileId} />
          <button type="button" className="rk-btn rk-btn--outline rk-btn--block" style={{ marginTop: 32 }} onClick={() => setBattle(undefined)}>닫기</button>
        </Modal>
      )}
    </main>
  );
}
