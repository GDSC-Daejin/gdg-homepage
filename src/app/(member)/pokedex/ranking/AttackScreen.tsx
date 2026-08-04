"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { rerollRankingOpponents, startRankingBattle } from "@/actions/pokedex-ranking";
import type { BattleType } from "@/lib/pokedex/battle-effects";
import type { RankingBattleDetail, RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { RANKING_ATTACKS_PER_DAY, rankingRecord } from "@/lib/pokedex/ranking-stats";
import { leadMatchup } from "@/lib/pokedex/type-matchup";
import { RankingBattleAnimation } from "../RankingBattleAnimation";
import { PokemonImage, Pips, TONE } from "./parts";

function displayName(name: string, nickname: string | null) {
  return nickname ? `${name} (${nickname})` : name;
}

export function AttackScreen({ profileId, state }: { profileId: string; state: RankingLeagueState }) {
  const entry = state.entry!;
  const [error, setError] = useState<string>();
  const [battle, setBattle] = useState<RankingBattleDetail>();
  const [pending, startTransition] = useTransition();

  const attacksLeft = Math.max(0, RANKING_ATTACKS_PER_DAY - entry.attacksToday);
  const record = rankingRecord(state.battles, profileId);
  const attackSlot = entry.activeAttackSlot ?? 1;
  const party = state.presets.find((preset) => preset.kind === "attack" && preset.slot === attackSlot)?.members ?? [];
  const partyPower = party.reduce((total, pokemon) => total + pokemon.combatPower, 0);
  const myLead = party[0];
  const ready = party.length === 3;

  function run(task: () => Promise<{ error?: string; battle?: RankingBattleDetail }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await task();
      if (result.error) setError(result.error);
      if (result.battle) setBattle(result.battle);
    });
  }

  return (
    <main className="rk-inner rk-page">
      <div className="rk-pagehead">
        <div>
          <h1 className="rk-title">오늘의 상대</h1>
          <p className="rk-lede">선봉 한 마리와 합산 전투력 천 단위만 공개돼요 · 매일 06:00에 새로 뽑혀요</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--rk-text-1)" }}>남은 공격 {attacksLeft}/{RANKING_ATTACKS_PER_DAY}</span>
            <Pips left={attacksLeft} total={RANKING_ATTACKS_PER_DAY} />
          </div>
          <button
            type="button"
            className="rk-btn rk-btn--outline"
            disabled={pending || entry.rerolled || entry.attacksToday > 0}
            onClick={() => run(rerollRankingOpponents)}
          >
            상대 리롤 ({entry.rerolled ? 0 : 1}/1)
          </button>
        </div>
      </div>

      <div className="rk-card rk-deckbar">
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "none" }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>내 공격 덱 {attackSlot}번</span>
          <span className="rk-num" style={{ fontSize: 11.5, color: "var(--rk-text-2)", whiteSpace: "nowrap" }}>
            합산 전투력 {partyPower.toLocaleString()} · 공격 {record.attack.wins}승 {record.attack.losses}패
          </span>
        </div>
        <div style={{ width: 1, height: 44, background: "var(--rk-line-soft)" }} className="rk-desktoponly" />
        <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
          {ready ? party.map((pokemon, index) => (
            <div key={pokemon.throwId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 10px", borderRadius: 12, background: "var(--rk-primary-bg)" }}>
              <span style={{ width: 19, height: 19, borderRadius: 999, background: "var(--rk-primary)", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{index + 1}</span>
              <PokemonImage src={pokemon.imagePath} size={38} alt={pokemon.name} />
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{pokemon.name}</span>
                <span className="rk-num" style={{ fontSize: 11, fontWeight: 600, color: "var(--rk-primary-heavy)" }}>{pokemon.combatPower}</span>
              </div>
            </div>
          )) : (
            <span style={{ fontSize: 13, color: "var(--rk-text-2)" }}>공격 덱 {attackSlot}번이 3마리가 아니에요. 내 덱에서 채워주세요.</span>
          )}
        </div>
        <Link href="/pokedex/ranking/deck" className="rk-btn rk-btn--outline">덱 바꾸기</Link>
      </div>

      {state.opponents.length === 0 ? (
        <div className="rk-card">
          <span className="rk-cardtitle">배정된 상대가 없어요</span>
          <p className="rk-cardsub">참전자가 늘어나거나 다음 06:00 갱신을 기다려주세요.</p>
        </div>
      ) : (
        <div className="rk-grid3">
          {state.opponents.map((opponent) => {
            // 공개된 선봉끼리만 본다 — 나머지 두 마리는 판정에 넣지 않는다.
            const matchup = leadMatchup(myLead?.battleType as BattleType | undefined, opponent.lead.battleType as BattleType);
            const tone = matchup ? TONE[matchup.tone] : TONE.neutral;
            return (
              <div key={opponent.allocationId} className="rk-oppcard">
                <div className="rk-oppstrip" style={{ color: tone.fg, background: tone.bg }}>
                  {matchup
                    ? `선봉 ${matchup.verdict} · 내 ${myLead.name} ↔ ${opponent.lead.name}`
                    : "공격 덱을 채우면 선봉 상성을 알려드려요"}
                </div>
                <div className="rk-oppbody">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span className="rk-truncate" style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.025em" }}>{displayName(opponent.name, opponent.nickname)}</span>
                    <PokemonImage src={opponent.lead.imagePath} size={56} alt={opponent.lead.name} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--rk-text-1)" }}>상대 방어 덱</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div className="rk-oppslot">
                        <PokemonImage src={opponent.lead.imagePath} size={46} alt={opponent.lead.name} />
                        <span style={{ fontSize: 10.5, fontWeight: 700 }}>선봉</span>
                      </div>
                      {[1, 2].map((slot) => (
                        <div key={slot} className="rk-oppslot rk-oppslot--hidden">
                          <span aria-hidden style={{ fontSize: 20, fontWeight: 800 }}>?</span>
                          <span style={{ fontSize: 10.5 }}>미공개</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, color: "var(--rk-text-2)" }}>합산 전투력</span>
                    <span className="rk-num" style={{ fontSize: 14, fontWeight: 700 }}>
                      {opponent.powerFloor.toLocaleString()}~{(opponent.powerFloor + 999).toLocaleString()}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: 11.5, color: "var(--rk-text-2)", lineHeight: 1.5 }}>
                    나머지 두 마리는 공개되지 않아요
                  </p>

                  <button
                    type="button"
                    className="rk-btn rk-btn--solid rk-btn--block"
                    style={{ marginTop: "auto" }}
                    disabled={pending || attacksLeft === 0 || !ready}
                    onClick={() => run(() => startRankingBattle(opponent.allocationId, attackSlot))}
                  >
                    {attacksLeft === 0 ? "공격 소진" : !ready ? "공격 덱 3마리 필요" : "공격하기"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 12, background: "var(--rk-fill-soft)" }}>
        <span style={{ fontSize: 13, color: "var(--rk-text-1)", lineHeight: 1.55 }}>
          공격에서 이기면 30점을 얻고 지면 30점을 잃어요. 결과는 바로 점수에 반영되고 <b style={{ fontWeight: 700 }}>기록</b>에서 다시 볼 수 있어요.
        </span>
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
