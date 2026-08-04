"use client";

import { useEffect, useState } from "react";
import type { RankingBattleDetail, RankingPokemon } from "@/lib/pokedex/ranking-league";
import type { BattleType } from "@/lib/pokedex/battle-effects";
import styles from "./DuelPanel.module.css";
import { BattleCoin } from "./BattleCoin";
import { PixelBattleEffect } from "./PixelBattleEffect";

type RankingBattlePhase = "coin" | "firstTurn" | "throw" | "release" | "sendoutThrow" | "sendoutRelease" | "attackerAttack" | "attackerImpact" | "defenderAttack" | "defenderImpact" | "recallOut" | "recallIn" | "recallDone" | "result";

export function shouldShowRankingPokemon(phase: RankingBattlePhase, changed: boolean) {
  return !["coin", "firstTurn", "throw"].includes(phase) && !(phase === "sendoutThrow" && changed);
}

function BattleLog({ battle, profileId }: { battle: RankingBattleDetail; profileId: string }) {
  const attackerWon = battle.winnerId === battle.attackerId;
  const mine = battle.attackerId === profileId ? "attacker" : "defender";
  return <>
    <p className="text-lg font-bold text-gray-900">{(battle.winnerId === profileId ? "승리" : "패배")} · {mine === "attacker" ? `${battle.attackerDelta > 0 ? "+" : ""}${battle.attackerDelta}` : `${battle.defenderDelta > 0 ? "+" : ""}${battle.defenderDelta}`}점</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">공격 파티</p><div className="mt-2 space-y-1">{battle.attackerTeam.map((pokemon) => <p key={pokemon.throwId} className="text-sm text-gray-800">{pokemon.name} · {pokemon.battleType} · 전투력 {pokemon.combatPower}</p>)}</div></div><div className="rounded-lg bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">방어 파티</p><div className="mt-2 space-y-1">{battle.defenderTeam.map((pokemon) => <p key={pokemon.throwId} className="text-sm text-gray-800">{pokemon.name} · {pokemon.battleType} · 전투력 {pokemon.combatPower}</p>)}</div></div></div>
    <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-gray-200"><table className="w-full text-sm"><thead><tr className="border-b border-gray-200 text-left text-gray-500"><th className="px-3 py-2">턴</th><th className="px-3 py-2">공격 피해</th><th className="px-3 py-2">방어 피해</th><th className="px-3 py-2">남은 체력</th></tr></thead><tbody>{battle.battleLog.map((turn, index) => <tr key={index} className="border-b border-gray-100 last:border-0"><td className="px-3 py-2">{index + 1}</td><td className="px-3 py-2">{turn.attackerDamage} × {turn.attackerTypeMultiplier} {turn.attackerMonoMultiplier > 1 ? "× 1.1" : ""}</td><td className="px-3 py-2">{turn.defenderDamage} × {turn.defenderTypeMultiplier} {turn.defenderMonoMultiplier > 1 ? "× 1.1" : ""}</td><td className="px-3 py-2">{turn.attackerHealth} / {turn.defenderHealth}</td></tr>)}</tbody></table></div>
    <p className="mt-3 text-xs text-gray-500">{attackerWon ? "공격 파티가 상대 파티를 모두 쓰러뜨렸어요." : "방어 파티가 공격 파티를 모두 쓰러뜨렸어요."}</p>
  </>;
}

function RankingBattleStatus({ pokemon, health, side }: { pokemon: RankingPokemon; health: number; side: "left" | "right" }) {
  const maximum = 1_000 + pokemon.combatPower;
  const percentage = Math.max(0, Math.min(100, health / maximum * 100));
  return <div className={`${styles.battleStatus} ${side === "left" ? styles.statusLeft : styles.statusRight}`}>
    <div className={styles.statusHeading}><strong>{pokemon.name}</strong><span>전투력 {pokemon.combatPower}</span></div>
    <div className={styles.healthRow}><b>HP:</b><div className={styles.healthTrack} role="progressbar" aria-label={`${pokemon.name} 체력`} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={health}><span className={styles.healthFill} style={{ width: `${percentage}%` }} /></div></div>
  </div>;
}

export function RankingBattleAnimation({ battle, profileId }: { battle: RankingBattleDetail; profileId: string }) {
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<RankingBattlePhase>("coin");
  const turnData = battle.battleLog[turn];
  const attacker = battle.attackerTeam[turnData?.attackerIndex ?? 0];
  const defender = battle.defenderTeam[turnData?.defenderIndex ?? 0];

  useEffect(() => {
    setTurn(0);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coinDelay = battle.firstTurnUserId ? (reduced ? 0 : 1_600) : 0;
    const firstTurnDelay = battle.firstTurnUserId ? (reduced ? 0 : 1_000) : 0;
    setPhase(battle.firstTurnUserId ? "coin" : "throw");
    const timers = [battle.firstTurnUserId ? window.setTimeout(() => setPhase("firstTurn"), coinDelay) : window.setTimeout(() => setPhase("throw"), coinDelay), window.setTimeout(() => setPhase("throw"), coinDelay + firstTurnDelay), window.setTimeout(() => setPhase("release"), coinDelay + firstTurnDelay + 700)];
    let delay = coinDelay + firstTurnDelay + 1_400;
    battle.battleLog.forEach((entry, index) => {
      const previous = battle.battleLog[index - 1];
      const changed = Boolean(previous && (previous.attackerIndex !== entry.attackerIndex || previous.defenderIndex !== entry.defenderIndex));
      if (changed) {
        timers.push(window.setTimeout(() => { setTurn(index); setPhase("sendoutThrow"); }, delay));
        delay += 900;
        timers.push(window.setTimeout(() => setPhase("sendoutRelease"), delay));
        delay += 650;
      }
      if (entry.actor !== "defender") {
        timers.push(window.setTimeout(() => { setTurn(index); setPhase("attackerAttack"); }, delay));
        delay += 600;
        timers.push(window.setTimeout(() => setPhase("attackerImpact"), delay));
        delay += 600;
      }
      if (entry.actor === "defender") {
        timers.push(window.setTimeout(() => { setTurn(index); setPhase("defenderAttack"); }, delay));
        delay += 600;
        timers.push(window.setTimeout(() => setPhase("defenderImpact"), delay));
        delay += 600;
      } else if (entry.defenderDamage > 0) {
        timers.push(window.setTimeout(() => setPhase("defenderAttack"), delay));
        delay += 600;
        timers.push(window.setTimeout(() => setPhase("defenderImpact"), delay));
        delay += 600;
      }
      if (entry.attackerHealth <= 0 || entry.defenderHealth <= 0) {
        timers.push(window.setTimeout(() => setPhase("recallOut"), delay));
        delay += 900;
        timers.push(window.setTimeout(() => setPhase("recallIn"), delay));
        delay += 900;
        timers.push(window.setTimeout(() => setPhase("recallDone"), delay));
        delay += 500;
      }
    });
    timers.push(window.setTimeout(() => setPhase("result"), delay));
    return () => timers.forEach(window.clearTimeout);
  }, [battle.id, battle.battleLog, battle.firstTurnUserId]);

  if (!turnData || !attacker || !defender) return <BattleLog battle={battle} profileId={profileId} />;

  const health = (side: "attacker" | "defender", pokemon: RankingPokemon, includeCurrent: boolean) => {
    const priorTurn = battle.battleLog.slice(0, turn + Number(includeCurrent)).reverse().find((entry) => side === "attacker" ? entry.attackerIndex === turnData.attackerIndex : entry.defenderIndex === turnData.defenderIndex);
    return priorTurn ? side === "attacker" ? priorTurn.attackerHealth : priorTurn.defenderHealth : 1_000 + pokemon.combatPower;
  };
  const attackerChanged = turn > 0 && battle.battleLog[turn - 1].attackerIndex !== turnData.attackerIndex;
  const defenderChanged = turn > 0 && battle.battleLog[turn - 1].defenderIndex !== turnData.defenderIndex;
  const attackerHit = ["defenderImpact", "recallOut", "recallIn", "recallDone", "result"].includes(phase);
  const defenderHit = ["attackerImpact", "defenderAttack", "defenderImpact", "recallOut", "recallIn", "recallDone", "result"].includes(phase);
  const attackerFainted = attackerHit && turnData.attackerHealth <= 0;
  const defenderFainted = defenderHit && turnData.defenderHealth <= 0;
  const throwing = phase === "throw" || phase === "sendoutThrow";
  const releasing = phase === "release" || phase === "sendoutRelease";
  const recalling = phase === "recallOut" || phase === "recallIn";
  const recallBallVisible = recalling || phase === "recallDone";
  const attackerRecalled = attackerFainted && (phase === "recallDone" || phase === "result");
  const defenderRecalled = defenderFainted && (phase === "recallDone" || phase === "result");
  const showAttacker = !attackerRecalled && shouldShowRankingPokemon(phase, attackerChanged);
  const showDefender = !defenderRecalled && shouldShowRankingPokemon(phase, defenderChanged);

  return <div className="text-center">
    <p className="text-sm font-semibold text-primary">랭킹전 시작!</p>
    <div className={`${styles.battleArena} relative mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ${phase === "attackerImpact" || phase === "defenderImpact" ? styles.screenShake : ""}`}>
      {phase === "coin" && <div className={`${styles.coinToss} absolute inset-0 z-30`}><BattleCoin heads={battle.firstTurnUserId === battle.attackerId} className={styles.coinFlip} /></div>}
      {phase === "firstTurn" && <div className={`${styles.firstTurn} absolute inset-0 z-30`} role="status"><span>{battle.firstTurnUserId === battle.attackerId ? "공격 파티" : "방어 파티"}</span><strong>선공!</strong></div>}
      <RankingBattleStatus pokemon={attacker} health={health("attacker", attacker, attackerHit)} side="left" />
      <RankingBattleStatus pokemon={defender} health={health("defender", defender, defenderHit)} side="right" />
      {(phase === "attackerAttack" || phase === "attackerImpact") && <PixelBattleEffect type={attacker.battleType as BattleType} stage={phase === "attackerAttack" ? 1 : 2} fromLeft className={styles.battleEffect} />}
      {(phase === "defenderAttack" || phase === "defenderImpact") && <PixelBattleEffect type={defender.battleType as BattleType} stage={phase === "defenderAttack" ? 1 : 2} fromLeft={false} className={styles.battleEffect} />}
      <div className={`col-start-1 row-start-1 ${styles.battleFighter} relative z-10`}>
        {throwing && (phase === "throw" || attackerChanged) && <img key={`attacker-throw-${turn}`} src="/pokedex/effects/monster-ball.png" alt="" aria-hidden className={`${styles.monsterBall} ${styles.throwLeft}`} />}
        {releasing && (phase === "release" || attackerChanged) && <span aria-hidden className={styles.ballRelease} />}
        {recallBallVisible && attackerFainted && <>{recalling && <span aria-hidden className={`${styles.recallBeam} ${styles.beamLeft} ${phase === "recallOut" ? styles.beamOutgoing : styles.beamReturning}`} />}<img src="/pokedex/effects/monster-ball-side.png" alt="" aria-hidden className={`${styles.recallBall} ${styles.recallLeft} ${phase === "recallIn" ? styles.recallAbsorb : ""}`} /></>}
        {showAttacker && <img key={attacker.throwId} src={attacker.imagePath} alt={attacker.name} className={`mx-auto h-24 w-24 object-contain ${styles.facingRight} ${releasing && (phase === "release" || attackerChanged) ? styles.pokemonReveal : ""} ${phase === "attackerAttack" ? styles.attackLeft : ""} ${phase === "defenderImpact" ? styles.hit : ""} ${attackerFainted ? styles.pokemonFaint : ""} ${phase === "recallOut" && attackerFainted ? styles.pokemonCapture : ""} ${phase === "recallIn" && attackerFainted ? styles.pokemonRecall : ""}`} />}
      </div>
      <div className={`col-start-3 row-start-1 ${styles.battleFighter} relative z-10`}>
        {throwing && (phase === "throw" || defenderChanged) && <img key={`defender-throw-${turn}`} src="/pokedex/effects/monster-ball.png" alt="" aria-hidden className={`${styles.monsterBall} ${styles.throwRight}`} />}
        {releasing && (phase === "release" || defenderChanged) && <span aria-hidden className={styles.ballRelease} />}
        {recallBallVisible && defenderFainted && <>{recalling && <span aria-hidden className={`${styles.recallBeam} ${styles.beamRight} ${phase === "recallOut" ? styles.beamOutgoing : styles.beamReturning}`} />}<img src="/pokedex/effects/monster-ball-side.png" alt="" aria-hidden className={`${styles.recallBall} ${styles.recallRight} ${phase === "recallIn" ? styles.recallAbsorb : ""}`} /></>}
        {showDefender && <img key={defender.throwId} src={defender.imagePath} alt={defender.name} className={`mx-auto h-24 w-24 object-contain ${releasing && (phase === "release" || defenderChanged) ? styles.pokemonReveal : ""} ${phase === "defenderAttack" ? styles.attackRight : ""} ${phase === "attackerImpact" ? styles.hit : ""} ${defenderFainted ? styles.pokemonFaint : ""} ${phase === "recallOut" && defenderFainted ? styles.pokemonCapture : ""} ${phase === "recallIn" && defenderFainted ? styles.pokemonRecall : ""}`} />}
      </div>
    </div>
    <div className={styles.battleMessage}><p>{phase === "coin" || phase === "firstTurn" ? "" : throwing ? "두 트레이너가 몬스터볼을 던졌어요!" : releasing ? "몬스터볼이 빛나며 포켓몬이 등장해요!" : phase === "attackerAttack" ? `${attacker.name}의 공격!` : phase === "attackerImpact" ? "공격이 적중했어요!" : phase === "defenderAttack" ? `${defender.name}의 공격!` : phase === "defenderImpact" ? "공격이 적중했어요!" : phase === "recallOut" ? "쓰러진 포켓몬을 몬스터볼로 회수해요!" : phase === "recallIn" ? "붉은 빛이 몬스터볼로 되돌아가요!" : phase === "recallDone" ? "다음 포켓몬을 내보낼 준비를 해요!" : battle.winnerId === battle.attackerId ? "공격 파티의 승리!" : "방어 파티의 승리!"}</p></div>
    {phase === "result" && <div className="mt-8 text-left"><BattleLog battle={battle} profileId={profileId} /></div>}
  </div>;
}
