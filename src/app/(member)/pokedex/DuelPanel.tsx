"use client";

import { useEffect, useState, useTransition } from "react";
import { acceptPokemonDuel, cancelPokemonDuel, createPokemonDuel, rejectPokemonDuel } from "@/actions/pokedex-duel";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { displayName } from "@/lib/format";
import { battleEffect } from "@/lib/pokedex/battle-effects";
import type { DuelMember, OwnedBattlePokemon, PokemonDuel } from "@/lib/pokedex/duel";
import styles from "./DuelPanel.module.css";
import { PixelBattleEffect } from "./PixelBattleEffect";

type DuelPanelProps = { profileId: string; members: DuelMember[]; ownedPokemon: OwnedBattlePokemon[]; duels: PokemonDuel[] };

function DuelAnimation({ duel }: { duel: PokemonDuel }) {
  const [stage, setStage] = useState(0);
  const challengerWon = duel.winnerId === duel.challenger.userId;
  const winner = challengerWon ? duel.challenger : duel.opponent;
  const effect = battleEffect(winner.battleType);

  useEffect(() => {
    setStage(0);
    const attack = window.setTimeout(() => setStage(1), 800);
    const impact = window.setTimeout(() => setStage(2), 1450);
    const result = window.setTimeout(() => setStage(3), 2300);
    return () => { window.clearTimeout(attack); window.clearTimeout(impact); window.clearTimeout(result); };
  }, [duel.id]);

  return <div className="text-center">
    <p className="text-sm font-semibold text-primary">결투 시작!</p>
    <div className={`relative mt-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3 ${stage === 2 ? styles.screenShake : ""}`}>
      <PixelBattleEffect type={winner.battleType} stage={stage} fromLeft={challengerWon} className={styles.battleEffect} />
      {[duel.challenger, duel.opponent].map((fighter, index) => {
        const won = fighter.userId === duel.winnerId;
        const attacking = stage === 1 && won;
        const hit = stage === 2 && !won;
        return <div key={fighter.userId} className={`${index ? "col-start-3 row-start-1" : "col-start-1 row-start-1"} relative z-10`}>
          <img src={fighter.imagePath!} alt={fighter.pokemonName!} className={`mx-auto h-24 w-24 object-contain ${attacking ? index ? styles.attackRight : styles.attackLeft : ""} ${hit ? styles.hit : ""}`} />
          <p className="mt-2 text-sm font-bold text-gray-900">{fighter.pokemonName}</p>
          <div className="mt-2 flex items-center justify-center gap-2"><Avatar name={fighter.name} avatarPath={fighter.avatarPath} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary" /><div className="text-left"><p className="text-xs font-medium text-gray-700">{displayName(fighter.name, fighter.nickname)}</p><p className="text-xs text-gray-500">전투력 {fighter.combatPower}</p></div></div>
        </div>;
      })}
      <span className="relative z-10 col-start-2 row-start-1 self-center text-sm font-bold text-gray-400">VS</span>
    </div>
    <p className="mt-5 min-h-6 text-sm font-medium text-gray-700">{stage === 0 ? `${winner.pokemonName}이 ${effect.label}의 힘을 모으고 있어요…` : stage === 1 ? `${effect.label} 공격!` : stage === 2 ? "강력한 일격이 적중했어요!" : `${winner.name}의 ${winner.pokemonName} 승리!`}</p>
    {stage === 3 && <p className="mt-1 text-xs text-gray-500">최종 점수 {duel.challenger.score} : {duel.opponent.score}</p>}
  </div>;
}

export function DuelPanel({ profileId, members, ownedPokemon, duels }: DuelPanelProps) {
  const [opponentId, setOpponentId] = useState(members[0]?.id ?? "");
  const [throwId, setThrowId] = useState(ownedPokemon[0]?.id ?? "");
  const [acceptThrows, setAcceptThrows] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<PokemonDuel>();
  const [pending, startTransition] = useTransition();
  const outgoing = duels.filter((duel) => duel.status === "pending" && duel.challenger.userId === profileId);
  const incoming = duels.filter((duel) => duel.status === "pending" && duel.opponent.userId === profileId);

  function run(task: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const response = await task();
      if (response.error) setError(response.error);
    });
  }

  return <>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="font-semibold text-gray-900">결투 신청</h2>
        <p className="mt-1 text-sm text-gray-500">포획한 포켓몬 한 마리로 활성 회원에게 도전하세요.</p>
        <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); run(() => createPokemonDuel(opponentId, throwId)); }}>
          <label className="block text-sm font-medium text-gray-700">상대<select value={opponentId} onChange={(event) => setOpponentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:bg-gray-50" disabled={!members.length}>{members.length ? members.map((member) => <option key={member.id} value={member.id}>{member.nickname ? `${member.name} (${member.nickname})` : member.name}</option>) : <option>신청 가능한 회원이 없어요</option>}</select></label>
          <label className="block text-sm font-medium text-gray-700">내 포켓몬<select value={throwId} onChange={(event) => setThrowId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:bg-gray-50" disabled={!ownedPokemon.length}>{ownedPokemon.length ? ownedPokemon.map((pokemon) => <option key={pokemon.id} value={pokemon.id}>{pokemon.pokemonName} · 전투력 {pokemon.combatPower}</option>) : <option>전투력이 있는 포켓몬이 없어요</option>}</select></label>
          <Button type="submit" variant="primary" className="w-full" disabled={pending || !opponentId || !throwId}>결투 신청</Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold text-gray-900">받은 신청</h2>
        {incoming.length === 0 ? <p className="mt-4 text-sm text-gray-500">받은 결투 신청이 없어요.</p> : <div className="mt-4 space-y-4">{incoming.map((duel) => <div key={duel.id} className="rounded-lg bg-gray-50 p-4 dark:bg-gray-200"><p className="text-sm font-medium text-gray-900">{duel.challenger.name}의 {duel.challenger.pokemonName} · 전투력 {duel.challenger.combatPower}</p><select value={acceptThrows[duel.id] ?? throwId} onChange={(event) => setAcceptThrows((current) => ({ ...current, [duel.id]: event.target.value }))} className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:bg-gray-50">{ownedPokemon.map((pokemon) => <option key={pokemon.id} value={pokemon.id}>{pokemon.pokemonName} · 전투력 {pokemon.combatPower}</option>)}</select><div className="mt-3 flex gap-2"><Button variant="primary" size="sm" disabled={pending || !ownedPokemon.length} onClick={() => run(async () => { const response = await acceptPokemonDuel(duel.id, acceptThrows[duel.id] ?? throwId); if (response.duel) setResult(response.duel); return response; })}>수락</Button><Button variant="danger-outline" size="sm" disabled={pending} onClick={() => run(() => rejectPokemonDuel(duel.id))}>거절</Button></div></div>)}</div>}
      </Card>
    </div>
    <Card className="mt-6"><h2 className="font-semibold text-gray-900">보낸 신청</h2>{outgoing.length === 0 ? <p className="mt-4 text-sm text-gray-500">보낸 결투 신청이 없어요.</p> : <div className="mt-4 space-y-3">{outgoing.map((duel) => <div key={duel.id} className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-200"><p className="text-sm text-gray-700"><strong className="text-gray-900">{duel.opponent.name}</strong>님이 수락하기를 기다리고 있어요.</p><Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => cancelPokemonDuel(duel.id))}>취소</Button></div>)}</div>}</Card>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {result && <Modal open onClose={() => setResult(undefined)} ariaLabel="결투 결과"><DuelAnimation duel={result} /><Button variant="secondary" className="mt-6 w-full" onClick={() => setResult(undefined)}>확인</Button></Modal>}
  </>;
}
