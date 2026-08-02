"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { activateRankingDefense, getRankingBattleDetail, joinRankingLeague, rerollRankingOpponents, saveRankingPreset, startRankingBattle } from "@/actions/pokedex-ranking";
import type { RankingBattleDetail, RankingLeagueState, RankingPokemon, RankingPreset } from "@/lib/pokedex/ranking-league";

type Props = { profileId: string; state: RankingLeagueState };

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

export function RankingLeaguePanel({ profileId, state }: Props) {
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

  if (!state.entry) return <Card><h2 className="font-semibold text-gray-900">랭킹전</h2><p className="mt-1 text-sm text-gray-500">서로 다른 포켓몬 6종을 포획하고 3:3 랭킹전에 도전하세요.</p><Button className="mt-5" variant="primary" disabled={pending || !state.eligible} onClick={() => run(joinRankingLeague)}>참전하기</Button>{!state.eligible && <p className="mt-3 text-sm text-gray-500">참전하려면 서로 다른 포켓몬 6종이 필요해요.</p>}{error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}</Card>;
  const entry = state.entry;

  return <>
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]"><Card><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-gray-900">랭킹전</h2><p className="mt-1 text-sm text-gray-500">시즌 종료까지 {new Date(state.season.endsAt).toLocaleDateString("ko-KR")} · 매일 06:00 상대 갱신</p></div><p className="text-3xl font-bold text-primary">{entry.rating}<span className="ml-1 text-sm font-medium text-gray-500">점</span></p></div><div className="mt-5 grid grid-cols-3 gap-3 text-center"><div><p className="text-xs text-gray-500">전적</p><p className="mt-1 font-semibold text-gray-900">{entry.wins}승 {entry.matches - entry.wins}패</p></div><div><p className="text-xs text-gray-500">공격</p><p className="mt-1 font-semibold text-gray-900">{entry.attacksToday}/3</p></div><div><p className="text-xs text-gray-500">방어 덱</p><p className="mt-1 font-semibold text-gray-900">{entry.activeDefenseSlot ? `${entry.activeDefenseSlot}번` : "미설정"}</p></div></div></Card>
      <Card><h2 className="font-semibold text-gray-900">시즌 랭킹</h2>{state.leaderboard.length === 0 ? <p className="mt-3 text-sm text-gray-500">아직 참가자가 없어요.</p> : <ol className="mt-3 space-y-2">{state.leaderboard.slice(0, 3).map((member) => <li key={`${member.rank}-${member.name}`} className="flex justify-between text-sm"><span className="font-medium text-gray-800">{member.rank}위 · {displayName(member.name, member.nickname)}</span><span className="font-mono text-gray-600">{member.rating}</span></li>)}</ol>}</Card></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><Card><h2 className="font-semibold text-gray-900">방어 프리셋</h2><p className="mt-1 text-sm text-gray-500">활성화한 덱은 다음 날 06:00부터 매칭에 반영돼요.</p><div className="mt-4 space-y-3">{[1, 2, 3].map((slot) => <PresetEditor key={slot} kind="defense" slot={slot} preset={presetAt("defense", slot)} ownedPokemon={state.ownedPokemon} activeDefenseSlot={entry.activeDefenseSlot} pending={pending} onSave={(ids) => run(() => saveRankingPreset("defense", slot, ids))} onActivate={() => run(() => activateRankingDefense(slot))} />)}</div></Card>
      <Card><h2 className="font-semibold text-gray-900">공격 프리셋</h2><p className="mt-1 text-sm text-gray-500">같은 종은 중복할 수 없고 전설/환상은 한 마리만 사용할 수 있어요.</p><div className="mt-4 space-y-3">{[1, 2, 3].map((slot) => <PresetEditor key={slot} kind="attack" slot={slot} preset={presetAt("attack", slot)} ownedPokemon={state.ownedPokemon} activeDefenseSlot={null} pending={pending} onSave={(ids) => run(() => saveRankingPreset("attack", slot, ids))} onActivate={() => undefined} />)}</div></Card></div>
    <Card className="mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">오늘의 상대</h2><p className="mt-1 text-sm text-gray-500">선봉과 총 전투력 천 단위만 보고 공격할 수 있어요.</p></div><div className="flex items-center gap-2"><select value={attackSlot} onChange={(event) => setAttackSlot(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:bg-gray-50" disabled={!attackPresets.length}>{attackPresets.map((preset) => <option key={preset.slot} value={preset.slot}>공격 프리셋 {preset.slot}</option>)}</select><Button size="sm" variant="secondary" disabled={pending || entry.rerolled || entry.attacksToday > 0} onClick={() => run(rerollRankingOpponents)}>상대 리롤</Button></div></div>{state.opponents.length === 0 ? <EmptyState title="배정된 상대가 없어요" description="참전자가 늘어나거나 다음 06:00 갱신을 기다려주세요." /> : <div className="mt-4 grid gap-3 md:grid-cols-3">{state.opponents.map((opponent) => <div key={opponent.allocationId} className="rounded-lg border border-gray-200 p-4"><div className="flex items-center gap-3"><img src={opponent.lead.imagePath} alt={opponent.lead.name} className="h-12 w-12 object-contain" /><div><p className="font-semibold text-gray-900">{displayName(opponent.name, opponent.nickname)}</p><p className="text-sm text-gray-600">선봉 {opponent.lead.name}</p></div></div><p className="mt-3 text-sm text-gray-500">합산 전투력 {opponent.powerFloor.toLocaleString()}~{(opponent.powerFloor + 999).toLocaleString()}</p><Button size="sm" variant="primary" className="mt-3 w-full" disabled={pending || !attackPresets.length || entry.attacksToday >= 3} onClick={() => run(() => startRankingBattle(opponent.allocationId, attackSlot))}>공격</Button></div>)}</div>}</Card>
    <Card className="mt-6"><h2 className="font-semibold text-gray-900">전투 기록</h2>{state.battles.length === 0 ? <p className="mt-3 text-sm text-gray-500">아직 랭킹전 기록이 없어요.</p> : <div className="mt-3 space-y-2">{state.battles.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3"><p className="text-sm text-gray-800">{item.opponentName} · {item.winnerId === profileId ? "승리" : "패배"}</p><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => getRankingBattleDetail(item.id))}>상세 보기</Button></div>)}</div>}</Card>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {battle && <Modal open onClose={() => setBattle(undefined)} ariaLabel="랭킹전 전투 기록"><BattleLog battle={battle} profileId={profileId} /><Button variant="secondary" className="mt-5 w-full" onClick={() => setBattle(undefined)}>닫기</Button></Modal>}
  </>;
}
