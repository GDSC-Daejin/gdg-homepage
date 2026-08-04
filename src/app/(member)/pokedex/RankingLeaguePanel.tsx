"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { activateRankingDefense, getRankingBattleDetail, joinRankingLeague, rerollRankingOpponents, saveRankingPreset, startRankingBattle } from "@/actions/pokedex-ranking";
import { battleEffect } from "@/lib/pokedex/battle-effects";
// 전투 연출은 랭킹전 새 화면과 함께 쓰므로 별도 파일에 있다. 기존 임포트 경로는 유지한다.
export { RankingBattleAnimation, shouldShowRankingPokemon } from "./RankingBattleAnimation";
import { RankingBattleAnimation } from "./RankingBattleAnimation";
import type { RankingBattleDetail, RankingBattleRole, RankingLeagueState, RankingPokemon, RankingPreset } from "@/lib/pokedex/ranking-league";
export { toggleRankingPresetMember } from "@/lib/pokedex/ranking-stats";
import { RANKING_ATTACKS_PER_DAY, toggleRankingPresetMember, RANKING_START_RATING, battleDelta, gapToPodium, rankingRecord, rankingScoreSeries, recentDefense, rewardProgress, seasonProgress, signedScore, timeUntilRefresh } from "@/lib/pokedex/ranking-stats";

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

/** 상대 갱신은 초 단위로 흐르므로 서버 렌더값과 어긋나지 않게 마운트 뒤에 채운다. */
function useRefreshCountdown() {
  const [text, setText] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setText(timeUntilRefresh(Date.now()));
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return text;
}

function AttackPips({ left, total }: { left: number; total: number }) {
  return <span aria-hidden className="flex gap-1">{Array.from({ length: total }, (_, index) => <span key={index} className={`h-2 w-6 rounded-full ${index < left ? "bg-primary" : "bg-gray-200"}`} />)}</span>;
}

/** 저장된 전투 기록에서 복원한 시즌 점수 추이. 별도 스냅샷 없이 그린다. */
function ScoreTrend({ series }: { series: { rating: number }[] }) {
  if (series.length < 2) return <p className="text-sm text-gray-500">전투를 치르면 점수 추이가 그려져요.</p>;
  const values = series.map((point) => point.rating);
  const [width, height, pad] = [640, 160, 18];
  const [low, high] = [Math.min(...values), Math.max(...values)];
  const span = high - low || 1;
  const x = (index: number) => pad + (index * (width - pad * 2)) / (values.length - 1);
  const y = (value: number) => pad + (1 - (value - low) / span) * (height - pad * 2);
  const line = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`시즌 점수 추이, 최근 ${values[values.length - 1]}점`}>
    <polygon points={`${line} ${x(values.length - 1).toFixed(1)},${height} ${x(0).toFixed(1)},${height}`} className="fill-primary" opacity={0.08} />
    <polyline points={line} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
    <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4.5} className="fill-primary" />
  </svg>;
}

function PresetEditor({ kind, presets, ownedPokemon, activeDefenseSlot, onSave, onActivate, pending }: {
  kind: "attack" | "defense"; presets: RankingPreset[]; ownedPokemon: RankingPokemon[]; activeDefenseSlot: number | null;
  onSave: (slot: number, throwIds: string[]) => void; onActivate: (slot: number) => void; pending: boolean;
}) {
  const [slot, setSlot] = useState(1);
  const preset = presets.find((item) => item.kind === kind && item.slot === slot);
  const presetIds = preset?.members.map((member) => member.throwId).join(",") ?? "";
  const [throwIds, setThrowIds] = useState<string[]>([]);
  const title = `${kind === "defense" ? "방어" : "공격"} 프리셋`;

  useEffect(() => setThrowIds(presetIds ? presetIds.split(",") : ownedPokemon.slice(0, 3).map((pokemon) => pokemon.throwId)), [ownedPokemon, presetIds, slot]);

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-gray-500">포켓몬 3마리를 선택하세요. 같은 종과 전설/환상 규칙은 저장할 때 확인해요.</p></div><div className="flex items-center gap-2 text-sm font-medium text-gray-700"><span>프리셋</span><div role="group" aria-label={`${title} 슬롯`} className="flex gap-1">{[1, 2, 3].map((value) => <button key={value} type="button" aria-pressed={slot === value} onClick={() => setSlot(value)} className={`h-8 w-8 rounded-full text-sm font-semibold transition-colors ${slot === value ? "bg-primary text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}>{value}{kind === "defense" && activeDefenseSlot === value ? <span className="sr-only"> 활성</span> : null}</button>)}</div></div></div>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{ownedPokemon.map((pokemon) => { const selected = throwIds.includes(pokemon.throwId); return <button key={pokemon.throwId} type="button" aria-pressed={selected} onClick={() => setThrowIds((current) => toggleRankingPresetMember(current, pokemon.throwId))} className={`rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary bg-primary-soft" : "border-gray-200 bg-white hover:bg-gray-50"}`}><img src={pokemon.imagePath} alt="" className="mx-auto h-20 w-20 object-contain" /><p className="mt-2 truncate text-center text-sm font-semibold text-gray-900">{pokemon.name}</p><p className="mt-1 text-center text-xs text-gray-500">전투력 {pokemon.combatPower}</p></button>; })}</div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-gray-700"><span className="text-primary">{throwIds.length}</span>/3 선택</p><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={pending || throwIds.length !== 3} onClick={() => onSave(slot, throwIds)}>저장</Button>{kind === "defense" && <Button size="sm" variant="primary" disabled={pending || throwIds.length !== 3} onClick={() => onActivate(slot)}>{activeDefenseSlot === slot ? "활성 덱" : "활성화"}</Button>}</div></div>
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
  const [logFilter, setLogFilter] = useState<"all" | RankingBattleRole>("all");
  const [pending, startTransition] = useTransition();
  const refreshIn = useRefreshCountdown();
  const attackPresets = state.presets.filter((preset) => preset.kind === "attack" && preset.members.length === 3);

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
  const now = Date.now();
  const season = seasonProgress(state.season, now);
  const record = rankingRecord(state.battles, profileId);
  const series = rankingScoreSeries(state.battles, entry.rating);
  const defense = recentDefense(state.battles, profileId, now);
  const reward = rewardProgress(entry);
  const podiumGap = gapToPodium(state.leaderboard, entry.rating, entry.rank);
  const attacksLeft = Math.max(0, RANKING_ATTACKS_PER_DAY - entry.attacksToday);
  const earned = entry.rating - RANKING_START_RATING;
  const inTopBoard = state.leaderboard.some((member) => member.userId === profileId);
  const battles = state.battles.filter((item) => logFilter === "all" || item.role === logFilter);
  const seasonDate = (value: string) => new Date(value).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

  return <>
    <div>
    <div className="grid gap-3 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <Card className="self-start overflow-hidden p-0">
        <div className="bg-primary px-5 py-4 text-white"><p className="text-xs font-semibold text-white/80">도감 랭킹전</p><h2 className="mt-1 text-lg font-bold">이번 시즌 현황</h2><p className="mt-1 text-sm text-white/80">종료 {new Date(state.season.endsAt).toLocaleDateString("ko-KR")} · {season.daysLeft}일 남음</p></div>
        <div className="bg-primary-soft px-5 py-5"><p className="text-xs font-semibold text-primary">내 점수</p><p className="mt-1 text-4xl font-bold text-primary">{entry.rating}<span className="ml-1 text-base font-medium text-gray-500">점</span></p><p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">{entry.rank ? <b className="font-semibold text-primary">{entry.rank}위</b> : <span>순위 집계 중</span>}<span aria-hidden>·</span><span>시즌 시작 대비 {signedScore(earned)}점</span></p></div>
        <dl className="divide-y divide-gray-100 px-5"><div className="flex items-center justify-between py-3 text-sm"><dt className="text-gray-500">전적</dt><dd className="font-semibold text-gray-900">{entry.wins}승 {entry.matches - entry.wins}패</dd></div><div className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><dt className="whitespace-nowrap text-gray-500">오늘 공격</dt><dd className="flex items-center gap-2 whitespace-nowrap font-semibold text-gray-900"><AttackPips left={attacksLeft} total={RANKING_ATTACKS_PER_DAY} />{attacksLeft}회</dd></div><div className="flex items-center justify-between py-3 text-sm"><dt className="text-gray-500">방어 덱</dt><dd className="font-semibold text-gray-900">{entry.activeDefenseSlot ? `${entry.activeDefenseSlot}번 활성` : "미설정"}</dd></div></dl>
        <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">상대는 매일 06:00에 갱신돼요 · 다음 갱신까지 <span className="font-mono tabular-nums">{refreshIn}</span></p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex flex-col justify-between gap-3 border-primary/40"><div><Badge tone="primary">공격 {attacksLeft}회 남음</Badge><h3 className="mt-3 text-base font-bold text-gray-900">{state.opponents.length ? `상대 ${state.opponents.length}명이 기다려요` : "배정된 상대가 없어요"}</h3><p className="mt-1 text-sm leading-6 text-gray-600">{attacksLeft ? "유리한 상대부터 고르면 점수를 더 벌 수 있어요." : "내일 06:00에 공격 횟수가 채워져요."}</p></div><a href="#ranking-opponents" className="text-sm font-semibold text-primary hover:underline">상대 보러 가기</a></Card>
        <Card className="flex flex-col justify-between gap-3"><div><Badge tone={entry.activeDefenseSlot ? "success" : "warning"}>{entry.activeDefenseSlot ? "활성" : "미설정"}</Badge><h3 className="mt-3 text-base font-bold text-gray-900">{entry.activeDefenseSlot ? `방어 덱 ${entry.activeDefenseSlot}번이 켜져 있어요` : "방어 덱이 비어 있어요"}</h3><p className="mt-1 text-sm leading-6 text-gray-600">{entry.activeDefenseSlot ? "바꾸면 다음 날 06:00부터 매칭에 반영돼요." : "비워두면 다른 트레이너가 그냥 이겨요."}</p></div><a href="#ranking-presets" className="text-sm font-semibold text-primary hover:underline">덱 짜러 가기</a></Card>
        <Card className="flex flex-col justify-between gap-3"><div><Badge tone={defense && defense.delta >= 0 ? "success" : defense ? "danger" : "neutral"}>{defense ? `${signedScore(defense.delta)}점` : "기록 없음"}</Badge><h3 className="mt-3 text-base font-bold text-gray-900">{defense ? `최근 24시간 방어 ${defense.wins}승 ${defense.losses}패` : "아직 방어 기록이 없어요"}</h3><p className="mt-1 text-sm leading-6 text-gray-600">{defense ? "자는 동안 치러진 방어전이에요." : "방어 덱을 켜면 자는 동안에도 점수를 지켜요."}</p></div><a href="#ranking-battles" className="text-sm font-semibold text-primary hover:underline">기록 보기</a></Card>
      </div>
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="self-start">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">점수 변화</h2><p className="mt-1 text-sm text-gray-500">시즌 시작 이후</p></div><div className="flex gap-6"><div className="text-right"><p className="text-xs text-gray-500">최고</p><p className="font-mono text-base font-bold text-gray-900">{Math.max(...series.map((point) => point.rating))}</p></div><div className="text-right"><p className="text-xs text-gray-500">시즌 시작 대비</p><p className={`font-mono text-base font-bold ${earned >= 0 ? "text-success" : "text-danger"}`}>{signedScore(earned)}</p></div></div></div>
        <div className="mt-4"><ScoreTrend series={series} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">이번 시즌 전적</dt><dd className="mt-1 text-lg font-bold text-gray-900">{entry.wins}승 {entry.matches - entry.wins}패</dd></div><div className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">획득 점수</dt><dd className={`mt-1 font-mono text-lg font-bold ${earned >= 0 ? "text-success" : "text-danger"}`}>{signedScore(earned)}</dd></div><div className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">최고 연승</dt><dd className="mt-1 text-lg font-bold text-gray-900">{record.bestStreak}연승</dd></div><div className="rounded-lg bg-gray-50 p-3"><dt className="text-xs text-gray-500">방어 승률</dt><dd className="mt-1 text-lg font-bold text-gray-900">{record.defenseWinRate === null ? "–" : `${record.defenseWinRate}%`}</dd></div></dl>
      </Card>
      <Card className="self-start overflow-hidden p-0"><div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><p className="text-xs font-semibold text-primary">LEADERBOARD</p><h2 className="mt-1 text-lg font-bold text-gray-900">시즌 랭킹</h2></div><span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">상위 {state.leaderboard.length}명</span></div>{state.leaderboard.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">아직 참가자가 없어요.</p> : <ol className="divide-y divide-gray-100">{state.leaderboard.slice(0, 3).map((member) => <li key={member.userId} aria-current={member.userId === profileId ? "true" : undefined} className={`flex items-center justify-between gap-3 px-5 py-4 ${member.userId === profileId ? "bg-primary-soft" : ""}`}><span className="flex min-w-0 items-center gap-3"><b className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${member.rank === 1 ? "bg-warning-soft text-warning" : "bg-gray-100 text-gray-600"}`}>{member.rank}</b><span className="truncate text-sm font-semibold text-gray-800">{displayName(member.name, member.nickname)}</span></span><span className="font-mono text-base font-semibold text-gray-700">{member.rating}</span></li>)}</ol>}
        {!inTopBoard && <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-primary-soft px-5 py-4" aria-current="true"><span className="flex min-w-0 items-center gap-3"><b className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white">{entry.rank ?? "–"}</b><span className="truncate text-sm font-semibold text-primary">내 순위</span></span><span className="font-mono text-base font-semibold text-primary">{entry.rating}</span></div>}
        <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">{podiumGap === null ? "3위 안에 들어 있어요. 시즌이 끝날 때까지 지켜보세요." : `3위까지 ${podiumGap}점 남았어요.`}</p>
      </Card>
    </div>
    <Card className="mt-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold text-gray-900">시즌 진행</h2><p className="mt-1 text-sm text-gray-500">{seasonDate(state.season.startsAt)} – {seasonDate(state.season.endsAt)} · {season.daysLeft}일 남음</p></div><Badge tone="primary">{season.percent}% 진행</Badge></div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="시즌 진행" aria-valuenow={season.percent} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary" style={{ width: `${season.percent}%` }} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-gray-200 p-4"><p className="text-sm font-semibold text-gray-900">시즌 보상</p><p className="mt-1 text-sm leading-6 text-gray-600">1~3위는 영구 트로피와 프로필 뱃지를 받아요.</p><p className="mt-2 text-sm font-medium text-primary">{reward.eligible ? "보상 조건을 채웠어요." : `조건까지 ${[reward.matchesLeft && `${reward.matchesLeft}전`, reward.attacksLeft && `공격 ${reward.attacksLeft}회`].filter(Boolean).join(" · ")} 남았어요.`}</p></div><div className="rounded-lg border border-gray-200 p-4"><p className="text-sm font-semibold text-gray-900">내 위치</p><p className="mt-1 text-sm leading-6 text-gray-600">시즌은 모두 {RANKING_START_RATING.toLocaleString()}점에서 시작해요.</p><p className="mt-2 text-sm font-medium text-primary">{entry.rank ? `${entry.rank}위 · ` : ""}{entry.rating}점 · 시즌 시작 대비 {signedScore(earned)}점</p></div></div>
    </Card>
    <div id="ranking-presets" className="mt-6 grid gap-6 scroll-mt-6 xl:grid-cols-2"><Card><h2 className="font-semibold text-gray-900">방어 프리셋</h2><p className="mt-1 text-sm text-gray-500">활성화한 덱은 다음 날 06:00부터 매칭에 반영돼요.</p><div className="mt-4"><PresetEditor kind="defense" presets={state.presets} ownedPokemon={state.ownedPokemon} activeDefenseSlot={entry.activeDefenseSlot} pending={pending} onSave={(slot, ids) => run(() => actions.savePreset("defense", slot, ids))} onActivate={(slot) => run(() => actions.activateDefense(slot))} /></div></Card>
      <Card><h2 className="font-semibold text-gray-900">공격 프리셋</h2><p className="mt-1 text-sm text-gray-500">같은 종은 중복할 수 없고 전설/환상은 한 마리만 사용할 수 있어요.</p><div className="mt-4"><PresetEditor kind="attack" presets={state.presets} ownedPokemon={state.ownedPokemon} activeDefenseSlot={null} pending={pending} onSave={(slot, ids) => run(() => actions.savePreset("attack", slot, ids))} onActivate={() => undefined} /></div></Card></div>
    <Card id="ranking-opponents" className="mt-6 scroll-mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">오늘의 상대</h2><p className="mt-1 text-sm text-gray-500">선봉과 총 전투력 천 단위만 보고 공격할 수 있어요.</p></div><div className="flex items-center gap-2"><select value={attackSlot} onChange={(event) => setAttackSlot(Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 dark:bg-gray-50" disabled={!attackPresets.length}>{attackPresets.map((preset) => <option key={preset.slot} value={preset.slot}>공격 프리셋 {preset.slot}</option>)}</select><Button size="sm" variant="secondary" disabled={pending || entry.rerolled || entry.attacksToday > 0} onClick={() => run(actions.rerollOpponents)}>상대 리롤 ({entry.rerolled ? 0 : 1}/1)</Button></div></div>{state.opponents.length === 0 ? <EmptyState title="배정된 상대가 없어요" description="참전자가 늘어나거나 다음 06:00 갱신을 기다려주세요." /> : <div className="mt-4 grid gap-3 md:grid-cols-3">{state.opponents.map((opponent) => { const partyType = opponent.partyType === "mixed" ? { label: "복합", className: "bg-gray-100 text-gray-700" } : opponent.partyType === "fire" ? { ...battleEffect(opponent.partyType), label: "불" } : battleEffect(opponent.partyType); return <div key={opponent.allocationId} className="rounded-lg border border-gray-200 p-4"><div className="flex items-center justify-evenly"><div className="flex min-w-0 items-center gap-2"><Avatar name={opponent.name} avatarPath={opponent.avatarPath} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary" /><div className="min-w-0"><p className="truncate font-semibold text-gray-900">{displayName(opponent.name, opponent.nickname)}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${partyType.className}`}>{partyType.label}</span></div></div><div className="shrink-0 text-center"><img src={opponent.lead.imagePath} alt={opponent.lead.name} className="h-28 w-28 object-contain" /><p className="-mt-2 text-xs font-medium text-gray-700">{opponent.lead.name}</p></div></div><p className="mt-3 text-xs font-semibold text-gray-500">상대 방어 덱</p><ul className="mt-2 flex gap-2">{[0, 1, 2].map((index) => <li key={index} className={`flex h-16 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs ${index === 0 ? "border border-gray-200 bg-gray-50 text-gray-700" : "border border-dashed border-gray-300 text-gray-400"}`}>{index === 0 ? <><img src={opponent.lead.imagePath} alt="" className="h-8 w-8 object-contain" /><span className="font-semibold">선봉</span></> : <><span aria-hidden className="text-base font-bold">?</span><span>미공개</span></>}</li>)}</ul><p className="mt-3 text-sm text-gray-500">합산 전투력 {opponent.powerFloor.toLocaleString()}~{(opponent.powerFloor + 999).toLocaleString()}</p><Button size="sm" variant="primary" className="mt-3 w-full" disabled={pending || !attackPresets.length || entry.attacksToday >= 3} onClick={() => run(() => actions.startBattle(opponent.allocationId, attackSlot))}>공격</Button></div>; })}</div>}</Card>
    <Card id="ranking-battles" className="mt-6 scroll-mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-gray-900">전투 기록</h2><p className="mt-1 text-sm text-gray-500">공격 {record.attack.wins}승 {record.attack.losses}패 · 방어 {record.defense.wins}승 {record.defense.losses}패</p></div><div role="group" aria-label="기록 필터" className="flex gap-1">{([["all", "전체"], ["attacker", "공격"], ["defender", "방어"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={logFilter === key} onClick={() => setLogFilter(key)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${logFilter === key ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{label}</button>)}</div></div>{battles.length === 0 ? <p className="mt-3 text-sm text-gray-500">{state.battles.length === 0 ? "아직 랭킹전 기록이 없어요." : "해당하는 기록이 없어요."}</p> : <ul className="mt-3 space-y-2">{battles.map((item) => { const won = item.winnerId === profileId; const delta = battleDelta(item); return <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${won ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>{won ? "승" : "패"}</span><span className="flex min-w-0 flex-1 flex-col gap-1"><span className="flex items-center gap-2"><Badge tone={item.role === "attacker" ? "primary" : "neutral"}>{item.role === "attacker" ? "공격" : "방어"}</Badge><span className="truncate text-sm font-semibold text-gray-900">{displayName(item.opponentName, item.opponentNickname)}</span></span><span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></span><span className={`font-mono text-sm font-bold ${delta >= 0 ? "text-success" : "text-danger"}`}>{signedScore(delta)}</span><Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => actions.getBattleDetail(item.id))}>상세 보기</Button></li>; })}</ul>}</Card>
    </div>
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
  { allocationId: "preview-opponent-1", name: "랭킹 트레이너", nickname: null, avatarPath: null, partyType: "electric", lead: { throwId: "opponent-magnemite", pokemonId: "magnemite", name: "코일", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/81.png", combatPower: 533, battleType: "electric", rarity: "uncommon" }, powerFloor: 1_500 },
  { allocationId: "preview-opponent-2", name: "랭킹 트레이너", nickname: null, avatarPath: null, partyType: "fire", lead: { throwId: "opponent-vulpix", pokemonId: "vulpix", name: "식스테일", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/37.png", combatPower: 524, battleType: "fire", rarity: "uncommon" }, powerFloor: 1_600 },
  { allocationId: "preview-opponent-3", name: "랭킹 트레이너", nickname: null, avatarPath: null, partyType: "water", lead: { throwId: "opponent-psyduck", pokemonId: "psyduck", name: "고라파덕", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/54.png", combatPower: 498, battleType: "water", rarity: "common" }, powerFloor: 1_400 },
];
const PREVIEW_REROLLED_OPPONENTS: RankingLeagueState["opponents"] = [
  { allocationId: "preview-opponent-4", name: "랭킹 트레이너", nickname: null, avatarPath: null, partyType: "rock", lead: { throwId: "opponent-onix", pokemonId: "onix", name: "롱스톤", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/95.png", combatPower: 574, battleType: "rock", rarity: "rare" }, powerFloor: 1_700 },
  { allocationId: "preview-opponent-5", name: "랭킹 트레이너", nickname: null, avatarPath: null, partyType: "mixed", lead: { throwId: "opponent-bellsprout", pokemonId: "bellsprout", name: "모다피", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/69.png", combatPower: 491, battleType: "grass", rarity: "common" }, powerFloor: 1_500 },
  { allocationId: "preview-opponent-6", name: "랭킹 트레이너", nickname: null, avatarPath: null, partyType: "water", lead: { throwId: "opponent-staryu", pokemonId: "staryu", name: "별가사리", imagePath: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/120.png", combatPower: 546, battleType: "water", rarity: "rare" }, powerFloor: 1_600 },
];
const PREVIEW_BATTLE: RankingBattleDetail = {
  id: "preview-ranking-battle",
  attackerId: PREVIEW_PROFILE_ID,
  defenderId: "ranking-preview-opponent",
  firstTurnUserId: PREVIEW_PROFILE_ID,
  attackerTeam: PREVIEW_POKEMON.slice(0, 3),
  defenderTeam: [PREVIEW_OPPONENTS[0].lead, PREVIEW_OPPONENTS[1].lead, PREVIEW_OPPONENTS[2].lead],
  battleLog: [
    { actor: "attacker", attackerIndex: 0, defenderIndex: 0, attackerDamage: 400, defenderDamage: 0, attackerHealth: 1_451, defenderHealth: 1_133, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 0, defenderIndex: 0, attackerDamage: 0, defenderDamage: 400, attackerHealth: 1_051, defenderHealth: 1_133, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 0, defenderIndex: 0, attackerDamage: 400, defenderDamage: 0, attackerHealth: 1_051, defenderHealth: 733, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 0, defenderIndex: 0, attackerDamage: 0, defenderDamage: 400, attackerHealth: 651, defenderHealth: 733, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 0, defenderIndex: 0, attackerDamage: 733, defenderDamage: 0, attackerHealth: 651, defenderHealth: 0, attackerTypeMultiplier: 1, defenderTypeMultiplier: 1.2, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 0, defenderIndex: 1, attackerDamage: 0, defenderDamage: 350, attackerHealth: 301, defenderHealth: 1_524, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 0, defenderIndex: 1, attackerDamage: 450, defenderDamage: 0, attackerHealth: 301, defenderHealth: 1_074, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 0, defenderIndex: 1, attackerDamage: 0, defenderDamage: 301, attackerHealth: 0, defenderHealth: 1_074, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 1, defenderIndex: 1, attackerDamage: 674, defenderDamage: 0, attackerHealth: 1_508, defenderHealth: 400, attackerTypeMultiplier: 1, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 1, defenderIndex: 1, attackerDamage: 0, defenderDamage: 400, attackerHealth: 1_108, defenderHealth: 400, attackerTypeMultiplier: 1, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 1, defenderIndex: 1, attackerDamage: 400, defenderDamage: 0, attackerHealth: 1_108, defenderHealth: 0, attackerTypeMultiplier: 1, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 1, defenderIndex: 2, attackerDamage: 0, defenderDamage: 382, attackerHealth: 726, defenderHealth: 1_519, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 1, defenderIndex: 2, attackerDamage: 390, defenderDamage: 0, attackerHealth: 726, defenderHealth: 1_129, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 1, defenderIndex: 2, attackerDamage: 0, defenderDamage: 726, attackerHealth: 0, defenderHealth: 1_129, attackerTypeMultiplier: 0.8, defenderTypeMultiplier: 1, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 2, defenderIndex: 2, attackerDamage: 738, defenderDamage: 0, attackerHealth: 1_427, defenderHealth: 391, attackerTypeMultiplier: 1.2, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "defender", attackerIndex: 2, defenderIndex: 2, attackerDamage: 0, defenderDamage: 391, attackerHealth: 1_036, defenderHealth: 391, attackerTypeMultiplier: 1.2, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
    { actor: "attacker", attackerIndex: 2, defenderIndex: 2, attackerDamage: 391, defenderDamage: 0, attackerHealth: 1_036, defenderHealth: 0, attackerTypeMultiplier: 1.2, defenderTypeMultiplier: 0.8, attackerMonoMultiplier: 1, defenderMonoMultiplier: 1 },
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
  leaderboard: [{ rank: 1, userId: "preview-champion", name: "랭킹 트레이너", nickname: "챔피언", rating: 1_260 }, { rank: 2, userId: "preview-thunder", name: "랭킹 트레이너", nickname: "번개", rating: 1_180 }, { rank: 3, userId: "preview-flame", name: "랭킹 트레이너", nickname: "불꽃", rating: 1_120 }],
};

export function RankingLeaguePreview() {
  const [state, setState] = useState<RankingLeagueState>(PREVIEW_STATE);
  const actions: RankingLeagueActions = {
    join: async () => {
      setState((current) => ({ ...current, entry: { rating: 1_000, matches: 0, attacks: 0, attacksToday: 0, wins: 0, activeDefenseSlot: null, activeAttackSlot: null, defenseEffectiveOn: null, rerolled: false, rank: 4 } }));
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
      setState((current) => ({ ...current, entry: current.entry && { ...current.entry, rating: current.entry.rating + 30, matches: current.entry.matches + 1, attacks: current.entry.attacks + 1, attacksToday: current.entry.attacksToday + 1, wins: current.entry.wins + 1 }, battles: [{ id: battle.id, role: "attacker", opponentName: current.opponents.find((opponent) => opponent.allocationId === allocationId)?.name ?? "랭킹 트레이너", opponentNickname: current.opponents.find((opponent) => opponent.allocationId === allocationId)?.nickname ?? null, winnerId: PREVIEW_PROFILE_ID, attackerDelta: 30, defenderDelta: -10, createdAt: battle.createdAt }, ...current.battles.filter((item) => item.id !== battle.id)] }));
      return { battle };
    },
    getBattleDetail: async () => ({ battle: PREVIEW_BATTLE }),
  };

  return <section className="mt-10"><h2 className="text-lg font-semibold text-gray-900">랭킹전 미리보기</h2><p className="mt-1 text-sm text-gray-500">미리보기용 포켓몬으로 실제 랭킹전 흐름을 확인할 수 있어요.</p><div className="mt-6"><RankingLeaguePanel profileId={PREVIEW_PROFILE_ID} state={state} actions={actions} /></div></section>;
}
