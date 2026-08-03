"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { activateRankingDefense, getRankingBattleDetail, joinRankingLeague, rerollRankingOpponents, saveRankingPreset, startRankingBattle } from "@/actions/pokedex-ranking";
import type { BattleType } from "@/lib/pokedex/battle-effects";
import type { RankingBattleDetail, RankingLeagueState, RankingPokemon, RankingPreset } from "@/lib/pokedex/ranking-league";
import styles from "./DuelPanel.module.css";
import { PixelBattleEffect } from "./PixelBattleEffect";

type RankingActionResult = { error?: string; battle?: RankingBattleDetail };
type RankingLeagueActions = {
  join: () => Promise<RankingActionResult>;
  savePreset: (kind: "attack" | "defense", slot: number, throwIds: string[]) => Promise<RankingActionResult>;
  activateDefense: (slot: number) => Promise<RankingActionResult>;
  rerollOpponents: () => Promise<RankingActionResult>;
  startBattle: (allocationId: string, attackPresetSlot: number) => Promise<RankingActionResult>;
  getBattleDetail: (battleId: string) => Promise<RankingActionResult>;
};
type Props = { profileId: string; state: RankingLeagueState; actions?: RankingLeagueActions };

function displayName(name: string, nickname: string | null) {
  return nickname ? `${name} (${nickname})` : name;
}

function PresetEditor({ kind, slot, preset, ownedPokemon, activeDefenseSlot, onSave, onActivate, pending }: {
  kind: "attack" | "defense"; slot: number; preset?: RankingPreset; ownedPokemon: RankingPokemon[]; activeDefenseSlot: number | null;
  onSave: (throwIds: string[]) => void; onActivate: () => void; pending: boolean;
}) {
  const initial = preset?.members.map((member) => member.throwId) ?? ownedPokemon.slice(0, 3).map((member) => member.throwId);
  const [throwIds, setThrowIds] = useState<string[]>(initial);
  const title = `${kind === "defense" ? "방어" : "공격"} 프리셋 ${slot}`;

  return <div className="rounded-lg border border-gray-200 p-3">
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900">{title}</p>{kind === "defense" && activeDefenseSlot === slot && <span className="text-xs font-semibold text-primary">활성</span>}</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((index) => <select key={index} value={throwIds[index] ?? ""} onChange={(event) => setThrowIds((current) => current.map((id, currentIndex) => currentIndex === index ? event.target.value : id))} className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:bg-gray-50" disabled={!ownedPokemon.length}>
      {ownedPokemon.map((pokemon) => <option key={pokemon.throwId} value={pokemon.throwId}>{pokemon.name} · {pokemon.combatPower}</option>)}
    </select>)}</div>
    <div className="mt-3 flex gap-2"><Button size="sm" variant="secondary" disabled={pending || throwIds.length !== 3} onClick={() => onSave(throwIds)}>저장</Button>{kind === "defense" && <Button size="sm" variant="primary" disabled={pending || preset?.members.length !== 3} onClick={onActivate}>활성화</Button>}</div>
  </div>;
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

function RankingBattleAnimation({ battle, profileId }: { battle: RankingBattleDetail; profileId: string }) {
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<"throw" | "release" | "sendoutThrow" | "sendoutRelease" | "attackerAttack" | "attackerImpact" | "defenderAttack" | "defenderImpact" | "recallOut" | "recallIn" | "recallDone" | "result">("throw");
  const turnData = battle.battleLog[turn];
  const attacker = battle.attackerTeam[turnData?.attackerIndex ?? 0];
  const defender = battle.defenderTeam[turnData?.defenderIndex ?? 0];

  useEffect(() => {
    setTurn(0);
    setPhase("throw");
    const timers = [window.setTimeout(() => setPhase("release"), 700)];
    let delay = 1_400;
    battle.battleLog.forEach((entry, index) => {
      const previous = battle.battleLog[index - 1];
      const changed = Boolean(previous && (previous.attackerIndex !== entry.attackerIndex || previous.defenderIndex !== entry.defenderIndex));
      if (changed) {
        timers.push(window.setTimeout(() => { setTurn(index); setPhase("sendoutThrow"); }, delay));
        delay += 900;
        timers.push(window.setTimeout(() => setPhase("sendoutRelease"), delay));
        delay += 650;
      }
      timers.push(window.setTimeout(() => { setTurn(index); setPhase("attackerAttack"); }, delay));
      delay += 600;
      timers.push(window.setTimeout(() => setPhase("attackerImpact"), delay));
      delay += 600;
      if (entry.defenderDamage > 0) {
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
  }, [battle.id, battle.battleLog]);

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
  const showAttacker = !attackerRecalled && !(throwing && (phase === "throw" || attackerChanged));
  const showDefender = !defenderRecalled && !(throwing && (phase === "throw" || defenderChanged));

  return <div className="text-center">
    <p className="text-sm font-semibold text-primary">랭킹전 시작!</p>
    <div className={`${styles.battleArena} relative mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 ${phase === "attackerImpact" || phase === "defenderImpact" ? styles.screenShake : ""}`}>
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
    <div className={styles.battleMessage}><p>{throwing ? "두 트레이너가 몬스터볼을 던졌어요!" : releasing ? "몬스터볼이 빛나며 포켓몬이 등장해요!" : phase === "attackerAttack" ? `${attacker.name}의 공격!` : phase === "attackerImpact" ? "공격이 적중했어요!" : phase === "defenderAttack" ? `${defender.name}의 반격!` : phase === "defenderImpact" ? "강력한 반격이 적중했어요!" : phase === "recallOut" ? "쓰러진 포켓몬을 몬스터볼로 회수해요!" : phase === "recallIn" ? "붉은 빛이 몬스터볼로 되돌아가요!" : phase === "recallDone" ? "다음 포켓몬을 내보낼 준비를 해요!" : battle.winnerId === battle.attackerId ? "공격 파티의 승리!" : "방어 파티의 승리!"}</p></div>
    {phase === "result" && <div className="mt-8 text-left"><BattleLog battle={battle} profileId={profileId} /></div>}
  </div>;
}

export function RankingLeaguePanel({ profileId, state, actions: providedActions }: Props) {
  const actions: RankingLeagueActions = providedActions ?? {
    join: joinRankingLeague,
    savePreset: saveRankingPreset,
    activateDefense: activateRankingDefense,
    rerollOpponents: rerollRankingOpponents,
    startBattle: startRankingBattle,
    getBattleDetail: getRankingBattleDetail,
  };
  const [error, setError] = useState<string>();
  const [attackSlot, setAttackSlot] = useState(1);
  const [battle, setBattle] = useState<RankingBattleDetail>();
  const [pending, startTransition] = useTransition();
  const attackPresets = state.presets.filter((preset) => preset.kind === "attack" && preset.members.length === 3);
  const presetAt = (kind: "attack" | "defense", slot: number) => state.presets.find((preset) => preset.kind === kind && preset.slot === slot);

  function run(task: () => Promise<{ error?: string; battle?: RankingBattleDetail }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await task();
      if (result.error) setError(result.error);
      if (result.battle) setBattle(result.battle);
    });
  }

  if (!state.entry) return <Card><h2 className="font-semibold text-gray-900">랭킹전</h2><p className="mt-1 text-sm text-gray-500">서로 다른 포켓몬 6종을 포획하고 3:3 랭킹전에 도전하세요.</p><Button className="mt-5" variant="primary" disabled={pending || !state.eligible} onClick={() => run(actions.join)}>참전하기</Button>{!state.eligible && <p className="mt-3 text-sm text-gray-500">참전하려면 서로 다른 포켓몬 6종이 필요해요.</p>}{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}</Card>;
  const entry = state.entry;

  return <>
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]"><Card><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-gray-900">랭킹전</h2><p className="mt-1 text-sm text-gray-500">시즌 종료까지 {new Date(state.season.endsAt).toLocaleDateString("ko-KR")} · 매일 06:00 상대 갱신</p></div><p className="text-3xl font-bold text-primary">{entry.rating}<span className="ml-1 text-sm font-medium text-gray-500">점</span></p></div><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div><p className="text-xs text-gray-500">전적</p><p className="mt-1 font-semibold text-gray-900">{entry.wins}승 {entry.matches - entry.wins}패</p></div><div><p className="text-xs text-gray-500">공격</p><p className="mt-1 font-semibold text-gray-900">{entry.attacksToday}/3</p></div><div><p className="text-xs text-gray-500">방어 덱</p><p className="mt-1 font-semibold text-gray-900">{entry.activeDefenseSlot ? `${entry.activeDefenseSlot}번` : "미설정"}</p></div></div></Card>
      <Card><h2 className="font-semibold text-gray-900">시즌 랭킹</h2>{state.leaderboard.length === 0 ? <p className="mt-3 text-sm text-gray-500">아직 참가자가 없어요.</p> : <ol className="mt-3 space-y-2">{state.leaderboard.slice(0, 3).map((member) => <li key={`${member.rank}-${member.name}`} className="flex justify-between text-sm"><span className="font-medium text-gray-800">{member.rank}위 · {displayName(member.name, member.nickname)}</span><span className="font-mono text-gray-600">{member.rating}</span></li>)}</ol>}</Card></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><Card><h2 className="font-semibold text-gray-900">방어 프리셋</h2><p className="mt-1 text-sm text-gray-500">활성화한 덱은 다음 날 06:00부터 매칭에 반영돼요.</p><div className="mt-4 space-y-3">{[1, 2, 3].map((slot) => <PresetEditor key={slot} kind="defense" slot={slot} preset={presetAt("defense", slot)} ownedPokemon={state.ownedPokemon} activeDefenseSlot={entry.activeDefenseSlot} pending={pending} onSave={(ids) => run(() => actions.savePreset("defense", slot, ids))} onActivate={() => run(() => actions.activateDefense(slot))} />)}</div></Card>
      <Card><h2 className="font-semibold text-gray-900">공격 프리셋</h2><p className="mt-1 text-sm text-gray-500">같은 종은 중복할 수 없고 전설/환상은 한 마리만 사용할 수 있어요.</p><div className="mt-4 space-y-3">{[1, 2, 3].map((slot) => <PresetEditor key={slot} kind="attack" slot={slot} preset={presetAt("attack", slot)} ownedPokemon={state.ownedPokemon} activeDefenseSlot={null} pending={pending} onSave={(ids) => run(() => actions.savePreset("attack", slot, ids))} onActivate={() => undefined} />)}</div></Card></div>
    <Card className="mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">오늘의 상대</h2><p className="mt-1 text-sm text-gray-500">선봉과 총 전투력 천 단위만 보고 공격할 수 있어요.</p></div><div className="flex items-center gap-2"><select value={attackSlot} onChange={(event) => setAttackSlot(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:bg-gray-50" disabled={!attackPresets.length}>{attackPresets.map((preset) => <option key={preset.slot} value={preset.slot}>공격 프리셋 {preset.slot}</option>)}</select><Button size="sm" variant="secondary" disabled={pending || entry.rerolled || entry.attacksToday > 0} onClick={() => run(actions.rerollOpponents)}>상대 리롤</Button></div></div>{state.opponents.length === 0 ? <EmptyState title="배정된 상대가 없어요" description="참전자가 늘어나거나 다음 06:00 갱신을 기다려주세요." /> : <div className="mt-4 grid gap-3 md:grid-cols-3">{state.opponents.map((opponent) => <div key={opponent.allocationId} className="rounded-lg border border-gray-200 p-4"><div className="flex items-center gap-3"><img src={opponent.lead.imagePath} alt={opponent.lead.name} className="h-12 w-12 object-contain" /><div><p className="font-semibold text-gray-900">{displayName(opponent.name, opponent.nickname)}</p><p className="text-sm text-gray-600">선봉 {opponent.lead.name}</p></div></div><p className="mt-3 text-sm text-gray-500">합산 전투력 {opponent.powerFloor.toLocaleString()}~{(opponent.powerFloor + 999).toLocaleString()}</p><Button size="sm" variant="primary" className="mt-3 w-full" disabled={pending || !attackPresets.length || entry.attacksToday >= 3} onClick={() => run(() => actions.startBattle(opponent.allocationId, attackSlot))}>공격</Button></div>)}</div>}</Card>
    <Card className="mt-6"><h2 className="font-semibold text-gray-900">전투 기록</h2>{state.battles.length === 0 ? <p className="mt-3 text-sm text-gray-500">아직 랭킹전 기록이 없어요.</p> : <div className="mt-3 space-y-2">{state.battles.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3"><p className="text-sm text-gray-800">{item.opponentName} · {item.winnerId === profileId ? "승리" : "패배"}</p><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.getBattleDetail(item.id))}>상세 보기</Button></div>)}</div>}</Card>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {battle && <Modal open onClose={() => setBattle(undefined)} ariaLabel="랭킹전 전투 기록" className="max-w-[96rem] p-8"><RankingBattleAnimation battle={battle} profileId={profileId} /><Button variant="secondary" className="mt-8 w-full" onClick={() => setBattle(undefined)}>닫기</Button></Modal>}
  </>;
}

const PREVIEW_PROFILE_ID = "ranking-preview-player";
const PREVIEW_POKEMON: RankingPokemon[] = [
  { throwId: "preview-squirtle", pokemonId: "squirtle", name: "꼬부기", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png", combatPower: 451, battleType: "water", rarity: "common" },
  { throwId: "preview-pikachu", pokemonId: "pikachu", name: "피카츄", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png", combatPower: 508, battleType: "electric", rarity: "uncommon" },
  { throwId: "preview-oddish", pokemonId: "oddish", name: "뚜벅쵸", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/43.png", combatPower: 427, battleType: "grass", rarity: "common" },
  { throwId: "preview-growlithe", pokemonId: "growlithe", name: "가디", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/58.png", combatPower: 532, battleType: "fire", rarity: "rare" },
  { throwId: "preview-geodude", pokemonId: "geodude", name: "꼬마돌", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/74.png", combatPower: 486, battleType: "rock", rarity: "uncommon" },
  { throwId: "preview-eevee", pokemonId: "eevee", name: "이브이", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png", combatPower: 519, battleType: "normal", rarity: "rare" },
];
const PREVIEW_OPPONENTS: RankingLeagueState["opponents"] = [
  { allocationId: "preview-opponent-1", name: "랭킹 트레이너", nickname: "번개", lead: { throwId: "opponent-magnemite", pokemonId: "magnemite", name: "코일", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/81.png", combatPower: 533, battleType: "electric", rarity: "uncommon" }, powerFloor: 1_500 },
  { allocationId: "preview-opponent-2", name: "랭킹 트레이너", nickname: "불꽃", lead: { throwId: "opponent-vulpix", pokemonId: "vulpix", name: "식스테일", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/37.png", combatPower: 524, battleType: "fire", rarity: "uncommon" }, powerFloor: 1_600 },
  { allocationId: "preview-opponent-3", name: "랭킹 트레이너", nickname: "물결", lead: { throwId: "opponent-psyduck", pokemonId: "psyduck", name: "고라파덕", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png", combatPower: 498, battleType: "water", rarity: "common" }, powerFloor: 1_400 },
];
const PREVIEW_REROLLED_OPPONENTS: RankingLeagueState["opponents"] = [
  { allocationId: "preview-opponent-4", name: "랭킹 트레이너", nickname: "바위", lead: { throwId: "opponent-onix", pokemonId: "onix", name: "롱스톤", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/95.png", combatPower: 574, battleType: "rock", rarity: "rare" }, powerFloor: 1_700 },
  { allocationId: "preview-opponent-5", name: "랭킹 트레이너", nickname: "숲", lead: { throwId: "opponent-bellsprout", pokemonId: "bellsprout", name: "모다피", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/69.png", combatPower: 491, battleType: "grass", rarity: "common" }, powerFloor: 1_500 },
  { allocationId: "preview-opponent-6", name: "랭킹 트레이너", nickname: "별", lead: { throwId: "opponent-staryu", pokemonId: "staryu", name: "별가사리", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/120.png", combatPower: 546, battleType: "water", rarity: "rare" }, powerFloor: 1_600 },
];
const PREVIEW_BATTLE: RankingBattleDetail = {
  id: "preview-ranking-battle",
  attackerId: PREVIEW_PROFILE_ID,
  defenderId: "ranking-preview-opponent",
  attackerTeam: PREVIEW_POKEMON.slice(0, 3),
  defenderTeam: [PREVIEW_OPPONENTS[0].lead, PREVIEW_OPPONENTS[1].lead, PREVIEW_OPPONENTS[2].lead],
  battleLog: [
    { attackerIndex: 0, defenderIndex: 0, attackerDamage: 400, defenderDamage: 400, attackerHealth: 1_051, defenderHealth: 1_133, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 0, defenderIndex: 0, attackerDamage: 400, defenderDamage: 400, attackerHealth: 651, defenderHealth: 733, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 0, defenderIndex: 0, attackerDamage: 733, defenderDamage: 0, attackerHealth: 651, defenderHealth: 0, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 0, defenderIndex: 1, attackerDamage: 450, defenderDamage: 350, attackerHealth: 301, defenderHealth: 1_074, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 0, defenderIndex: 1, attackerDamage: 400, defenderDamage: 301, attackerHealth: 0, defenderHealth: 674, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 1, defenderIndex: 1, attackerDamage: 674, defenderDamage: 0, attackerHealth: 1_508, defenderHealth: 0, attackerTypeMultiplier: 1, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 1, defenderIndex: 2, attackerDamage: 390, defenderDamage: 382, attackerHealth: 1_126, defenderHealth: 1_108, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 1, defenderIndex: 2, attackerDamage: 370, defenderDamage: 1_126, attackerHealth: 0, defenderHealth: 738, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { attackerIndex: 2, defenderIndex: 2, attackerDamage: 738, defenderDamage: 0, attackerHealth: 1_427, defenderHealth: 0, attackerTypeMultiplier: 1.2, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
  ],
  winnerId: PREVIEW_PROFILE_ID,
  attackerDelta: 30,
  defenderDelta: -10,
  createdAt: "2026-08-02T00:00:00.000Z",
};
const PREVIEW_STATE: RankingLeagueState = {
  eligible: true,
  season: { id: "preview-season", startsAt: "2026-07-20T21:00:00.000Z", endsAt: "2026-08-17T21:00:00.000Z" },
  entry: null,
  ownedPokemon: PREVIEW_POKEMON,
  presets: [],
  opponents: PREVIEW_OPPONENTS,
  battles: [],
  leaderboard: [{ rank: 1, name: "랭킹 트레이너", nickname: "챔피언", rating: 1_260 }, { rank: 2, name: "랭킹 트레이너", nickname: "번개", rating: 1_180 }, { rank: 3, name: "랭킹 트레이너", nickname: "불꽃", rating: 1_120 }],
};

export function RankingLeaguePreview() {
  const [state, setState] = useState<RankingLeagueState>(PREVIEW_STATE);
  const actions: RankingLeagueActions = {
    join: async () => {
      setState((current) => ({ ...current, entry: { rating: 1_000, matches: 0, attacks: 0, attacksToday: 0, wins: 0, activeDefenseSlot: null, defenseEffectiveOn: null, rerolled: false } }));
      return {};
    },
    savePreset: async (kind, slot, throwIds) => {
      setState((current) => ({ ...current, presets: [...current.presets.filter((preset) => preset.kind !== kind || preset.slot !== slot), { kind, slot, members: throwIds.map((throwId) => current.ownedPokemon.find((pokemon) => pokemon.throwId === throwId)).filter((pokemon): pokemon is RankingPokemon => Boolean(pokemon)) }] }));
      return {};
    },
    activateDefense: async (slot) => {
      setState((current) => ({ ...current, entry: current.entry && { ...current.entry, activeDefenseSlot: slot, defenseEffectiveOn: "2026-08-03T21:00:00.000Z" } }));
      return {};
    },
    rerollOpponents: async () => {
      setState((current) => ({ ...current, opponents: PREVIEW_REROLLED_OPPONENTS, entry: current.entry && { ...current.entry, rerolled: true } }));
      return {};
    },
    startBattle: async (allocationId, attackPresetSlot) => {
      const battle = { ...PREVIEW_BATTLE, attackerTeam: state.presets.find((preset) => preset.kind === "attack" && preset.slot === attackPresetSlot)?.members ?? PREVIEW_BATTLE.attackerTeam };
      setState((current) => ({ ...current, entry: current.entry && { ...current.entry, rating: current.entry.rating + 30, matches: current.entry.matches + 1, attacks: current.entry.attacks + 1, attacksToday: current.entry.attacksToday + 1, wins: current.entry.wins + 1 }, battles: [{ id: battle.id, opponentName: current.opponents.find((opponent) => opponent.allocationId === allocationId)?.name ?? "랭킹 트레이너", winnerId: PREVIEW_PROFILE_ID, attackerDelta: 30, defenderDelta: -10, createdAt: battle.createdAt }, ...current.battles.filter((item) => item.id !== battle.id)] }));
      return { battle };
    },
    getBattleDetail: async () => ({ battle: PREVIEW_BATTLE }),
  };

  return <section className="mt-10"><h2 className="text-lg font-semibold text-gray-900">랭킹전 미리보기</h2><p className="mt-1 text-sm text-gray-500">미리보기용 포켓몬으로 실제 랭킹전 흐름을 확인할 수 있어요.</p><div className="mt-6"><RankingLeaguePanel profileId={PREVIEW_PROFILE_ID} state={state} actions={actions} /></div></section>;
}
