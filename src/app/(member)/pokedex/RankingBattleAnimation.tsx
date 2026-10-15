"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import type { RankingBattleDetail, RankingPokemon, RankingTurn } from "@/lib/pokedex/ranking-league";
import { BattleCoin } from "./BattleCoin";
import { PixiRankingBattleScene, type RankingScenePhase } from "./PixiRankingBattleScene";
import styles from "./DuelPanel.module.css";

type Step = { turn: number; phase: RankingScenePhase; actor: "attacker" | "defender" | null; duration: number };

export function shouldShowRankingPokemon(phase: RankingScenePhase, changed: boolean) {
  return phase !== "intro" && !(phase === "sendout" && changed);
}

export function buildRankingBattleSteps(battle: RankingBattleDetail): Step[] {
  const steps: Step[] = battle.firstTurnUserId ? [{ turn: 0, phase: "intro", actor: null, duration: 1_300 }] : [];
  battle.battleLog.forEach((entry, turn) => {
    const previous = battle.battleLog[turn - 1];
    if (previous && (previous.attackerIndex !== entry.attackerIndex || previous.defenderIndex !== entry.defenderIndex)) steps.push({ turn, phase: "sendout", actor: null, duration: 850 });
    const actors: Array<"attacker" | "defender"> = entry.actor === "attacker" || entry.actor === "defender" ? [entry.actor] : ["attacker"];
    if (!entry.actor && entry.defenderDamage > 0) actors.push("defender");
    actors.forEach((actor) => {
      steps.push({ turn, phase: "charge", actor, duration: 280 });
      steps.push({ turn, phase: "attack", actor, duration: 420 });
      steps.push({ turn, phase: "impact", actor, duration: 520 });
    });
    if (entry.attackerHealth <= 0 || entry.defenderHealth <= 0) steps.push({ turn, phase: "recall", actor: entry.attackerHealth <= 0 ? "attacker" : "defender", duration: 700 });
  });
  return [...steps, { turn: Math.max(battle.battleLog.length - 1, 0), phase: "result", actor: null, duration: 0 }];
}

function BattleLog({ battle, profileId }: { battle: RankingBattleDetail; profileId: string }) {
  const mine = battle.attackerId === profileId ? "attacker" : "defender";
  const delta = mine === "attacker" ? battle.attackerDelta : battle.defenderDelta;
  return <>
    <p className="text-lg font-bold text-gray-900">{battle.winnerId === profileId ? "승리" : "패배"} · {delta > 0 ? "+" : ""}{delta}점</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{[["공격 파티", battle.attackerTeam], ["방어 파티", battle.defenderTeam]].map(([label, team]) => <div key={label as string} className="rounded-lg bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">{label as string}</p><div className="mt-2 space-y-1">{(team as RankingPokemon[]).map((pokemon) => <p key={pokemon.throwId} className="text-sm text-gray-800">{pokemon.name} · {pokemon.battleType} · 전투력 {pokemon.combatPower}</p>)}</div></div>)}</div>
    <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-gray-200"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-3 py-2">턴</th><th className="px-3 py-2">공격 피해</th><th className="px-3 py-2">방어 피해</th><th className="px-3 py-2">남은 체력</th></tr></thead><tbody>{battle.battleLog.map((turn, index) => <tr key={index} className="border-b border-gray-100 last:border-0"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2">{turn.attackerDamage}</td><td className="px-3 py-2">{turn.defenderDamage}</td><td className="px-3 py-2">{turn.attackerHealth} / {turn.defenderHealth}</td></tr>)}</tbody></table></div>
  </>;
}

function RankingBattleStatus({ pokemon, health, side }: { pokemon: RankingPokemon; health: number; side: "left" | "right" }) {
  const maximum = 1_000 + pokemon.combatPower;
  const percentage = Math.max(0, Math.min(100, health / maximum * 100));
  return <div className={`${styles.battleStatus} ${side === "left" ? styles.statusLeft : styles.statusRight}`}><div className={styles.statusHeading}><strong>{pokemon.name}</strong><span>전투력 {pokemon.combatPower}</span></div><div className={styles.healthRow}><b>HP:</b><div className={styles.healthTrack} role="progressbar" aria-label={`${pokemon.name} 체력`} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={health}><span className={styles.healthFill} style={{ width: `${percentage}%` }} /></div></div></div>;
}

function healthAt(log: RankingTurn[], turn: number, side: "attacker" | "defender", index: number, includeCurrent: boolean, pokemon: RankingPokemon) {
  const entry = log.slice(0, turn + Number(includeCurrent)).reverse().find((item) => side === "attacker" ? item.attackerIndex === index : item.defenderIndex === index);
  return entry ? side === "attacker" ? entry.attackerHealth : entry.defenderHealth : 1_000 + pokemon.combatPower;
}

export function RankingBattleAnimation({ battle, profileId }: { battle: RankingBattleDetail; profileId: string }) {
  const steps = useMemo(() => buildRankingBattleSteps(battle), [battle]);
  const [stepIndex, setStepIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [sceneAvailable, setSceneAvailable] = useState(true);
  const [reduced, setReduced] = useState(false);
  const step = steps[stepIndex] ?? steps.at(-1)!;
  const turn = battle.battleLog[step.turn];
  const attacker = battle.attackerTeam[turn?.attackerIndex ?? 0];
  const defender = battle.defenderTeam[turn?.defenderIndex ?? 0];
  const complete = step.phase === "result";

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    setStepIndex(reduced ? steps.length - 1 : 0);
    setPaused(false);
    setSceneAvailable(true);
  }, [battle.id, reduced, steps.length]);

  useEffect(() => {
    if (reduced || paused || complete) return;
    const timer = window.setTimeout(() => setStepIndex((index) => Math.min(index + 1, steps.length - 1)), step.duration / speed);
    return () => window.clearTimeout(timer);
  }, [complete, paused, reduced, speed, step.duration, steps.length]);

  if (!turn || !attacker || !defender) return <BattleLog battle={battle} profileId={profileId} />;

  const includeCurrent = step.phase === "impact" || step.phase === "recall" || complete;
  const attackerHealth = healthAt(battle.battleLog, step.turn, "attacker", turn.attackerIndex, includeCurrent, attacker);
  const defenderHealth = healthAt(battle.battleLog, step.turn, "defender", turn.defenderIndex, includeCurrent, defender);
  const attacking = step.actor === "attacker" ? attacker : defender;
  const multiplier = step.actor === "attacker" ? turn.attackerTypeMultiplier : turn.defenderTypeMultiplier;
  const damage = step.actor === "attacker" ? turn.attackerDamage : turn.defenderDamage;
  const message = complete ? (battle.winnerId === battle.attackerId ? "공격 파티의 승리!" : "방어 파티의 승리!") : step.phase === "intro" ? `${battle.firstTurnUserId === battle.attackerId ? "공격 파티" : "방어 파티"} 선공!` : step.phase === "sendout" ? "다음 포켓몬을 내보냅니다!" : step.phase === "charge" ? `${attacking.name}의 공격 준비!` : step.phase === "attack" ? `${attacking.name}의 공격!` : step.phase === "impact" ? `${damage} 피해! ${multiplier > 1 ? "효과가 굉장했다!" : multiplier < 1 ? "효과가 별로였다…" : ""}` : "쓰러진 포켓몬을 회수합니다!";

  return <div className="text-center">
    <p className="text-sm font-semibold text-primary">랭킹전 시작!</p>
    <div className={`${styles.battleArena} relative mt-7 min-h-72 ${step.phase === "impact" ? styles.screenShake : ""}`}>
      {sceneAvailable && !reduced && <PixiRankingBattleScene attacker={attacker} defender={defender} phase={step.phase} actor={step.actor} paused={paused} onUnavailable={() => { setSceneAvailable(false); setStepIndex(steps.length - 1); }} />}
      {step.phase === "intro" && battle.firstTurnUserId && <div className={`${styles.coinToss} absolute inset-0 z-30`}><BattleCoin heads={battle.firstTurnUserId === battle.attackerId} className={styles.coinFlip} /></div>}
      <RankingBattleStatus pokemon={attacker} health={attackerHealth} side="left" />
      <RankingBattleStatus pokemon={defender} health={defenderHealth} side="right" />
    </div>
    <div className={styles.battleMessage} aria-live="polite"><p>{message}</p></div>
    <div className="mt-5 flex flex-wrap justify-center gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setPaused((value) => !value)} disabled={complete}>{paused ? "계속" : "일시정지"}</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setStepIndex(0); setPaused(false); }} disabled={reduced}>다시 보기</Button><Button type="button" variant="ghost" size="sm" onClick={() => setSpeed((value) => value === 1 ? 2 : 1)} disabled={complete}>{speed}배속</Button><Button type="button" variant="ghost" size="sm" onClick={() => setStepIndex(steps.length - 1)} disabled={complete}>결과 보기</Button></div>
    {(complete || !sceneAvailable) && <div className="mt-8 text-left"><BattleLog battle={battle} profileId={profileId} /></div>}
  </div>;
}
