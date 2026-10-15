"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { joinRankingLeague } from "@/actions/pokedex-ranking";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { AttackScreen } from "./AttackScreen";
import { DeckScreen } from "./DeckScreen";
import { HomeScreen } from "./HomeScreen";
import { LogScreen } from "./LogScreen";
import { PokemonImage } from "./parts";

export type RankingPage = "home" | "attack" | "deck" | "log";


/**
 * 랭킹전 4페이지 본문. 상태가 없거나 참전 전인 경우를 여기서 걸러내고,
 * 나머지는 각 화면으로 넘긴다. 원본 시안은 /ranking-preview 참고.
 */
function RankingOnboarding({ page, state, readOnly }: { page: RankingPage; state: RankingLeagueState; readOnly: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const ownedPokemon = [...new Map(state.ownedPokemon.map((pokemon) => [pokemon.pokemonId, pokemon])).values()];
  const remaining = Math.max(6 - ownedPokemon.length, 0);

  function join() {
    setError(undefined);
    startTransition(async () => {
      const result = await joinRankingLeague();
      if (result.error) setError(result.error);
    });
  }

  const party = ownedPokemon.slice(0, 3);
  const action = state.eligible && !readOnly ? (
    <button type="button" className="rk-btn rk-btn--solid" disabled={pending} onClick={join}>{pending ? "참가 중…" : "랭킹전 참가하기"}</button>
  ) : <Link href="/pokedex" className="rk-btn rk-btn--outline">도감으로 가기</Link>;

  if (page === "home") {
    return (
      <>
        <section className="rk-hero">
          <div className="rk-inner">
            <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="rk-tierchip">랭킹전 준비</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(247,247,248,.75)" }}>내 보유 현황</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(247,247,248,.5)" }}>서로 다른 포켓몬</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}><span className="rk-heroscore">{ownedPokemon.length}</span><span style={{ fontSize: 15, fontWeight: 700, color: "rgba(247,247,248,.5)" }}>/ 6종</span></div>
                <span style={{ fontSize: 12, color: "rgba(247,247,248,.55)" }}>{state.eligible ? "참가 조건을 채웠어요" : `참가까지 ${remaining}종 남았어요`}</span>
              </div>
              <div className="rk-attackbox"><span style={{ fontSize: 12.5, fontWeight: 700 }}>참가 조건</span><span style={{ fontSize: 11, color: "rgba(247,247,248,.5)" }}>서로 다른 포켓몬 6종을 모으면 3:3 랭킹전에 참가할 수 있어요</span></div>
            </div>
            <div className="rk-party">
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: "rgba(247,247,248,.4)" }}>MY POKÉMON</span>
              <div className="rk-partyrow">
                {party.length ? party.map((pokemon) => <div key={pokemon.pokemonId} className="rk-partyslot"><div className="rk-stage"><PokemonImage src={pokemon.imagePath} size={104} alt={pokemon.name} /></div><div className="rk-nameplate"><span style={{ fontSize: 13.5, fontWeight: 700 }}>{pokemon.name}</span><span className="rk-num" style={{ fontSize: 11, color: "var(--rk-hero-primary)" }}>전투력 {pokemon.combatPower}</span></div></div>) : [0, 1, 2].map((index) => <span key={index} className="rk-stage" style={{ borderRadius: 16, border: "1px dashed rgba(247,247,248,.25)", color: "rgba(247,247,248,.4)", fontSize: 22, alignItems: "center" }}>+</span>)}
              </div>
            </div>
            <div className="rk-todaycard"><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: "var(--rk-hero-primary)" }}>NEXT STEP</span><span style={{ fontSize: 17, fontWeight: 800 }}>{state.eligible ? "참가할 준비가 됐어요" : "새 포켓몬을 더 모아보세요"}</span><span style={{ fontSize: 11.5, color: "rgba(247,247,248,.6)", lineHeight: 1.5 }}>{readOnly && state.eligible ? "정식 오픈 뒤에 공격·방어 덱을 만들 수 있어요" : "예시 트레이너나 점수는 표시하지 않고 내 실제 보유 정보만 보여줘요"}</span>{action}</div>
          </div>
        </section>
        <main className="rk-inner rk-page">
          <div className="rk-grid2"><section className="rk-card rk-card--accent"><span className="rk-cardtitle">참가 준비</span><p className="rk-cardsub">{state.eligible ? "지금 보유한 포켓몬으로 공격·방어 덱을 구성할 수 있어요." : "같은 포켓몬은 한 종으로 계산돼요. 새로운 포켓몬을 포획해 보세요."}</p></section><section className="rk-card"><span className="rk-cardtitle">시즌 랭킹</span><p className="rk-cardsub">참가 후 내 점수·순위·전투 기록을 이곳에서 확인할 수 있어요.</p></section></div>
        </main>
      </>
    );
  }

  if (page === "attack") return <main className="rk-inner rk-page"><div className="rk-pagehead"><div><h1 className="rk-title">오늘의 상대</h1><p className="rk-lede">참가하면 매일 06:00에 내 공격 덱에 맞는 상대가 배정돼요</p></div><span className="rk-badge rk-badge--warn">참가 전</span></div><section className="rk-card rk-deckbar"><div><span className="rk-cardtitle">내 공격 후보</span><p className="rk-cardsub">현재 보유한 포켓몬 중 전투력이 높은 순서예요</p></div><div className="rk-slots" style={{ flex: 1 }}>{party.map((pokemon, index) => <div key={pokemon.pokemonId} className="rk-slot"><span className="rk-order">{index + 1}</span><PokemonImage src={pokemon.imagePath} size={52} alt={pokemon.name} /><span>{pokemon.name}</span><span className="rk-num">{pokemon.combatPower}</span></div>)}</div></section><section className="rk-card"><span className="rk-cardtitle">상대 배정 대기 중</span><p className="rk-cardsub">랭킹전에 참가하면 공개된 선봉과 전투력 구간을 보고 상대를 고를 수 있어요.</p>{action}</section></main>;

  if (page === "deck") return <main className="rk-inner rk-page"><div className="rk-pagehead"><div><h1 className="rk-title">내 덱</h1><p className="rk-lede">보유 포켓몬으로 참가 후 사용할 공격·방어 덱을 미리 확인해요</p></div><span className="rk-badge rk-badge--warn">참가 전</span></div><section className="rk-card"><div className="rk-cardhead"><div><span className="rk-cardtitle">보유 포켓몬 {ownedPokemon.length}</span><p className="rk-cardsub">각 포켓몬의 실제 전투력이에요</p></div>{action}</div>{ownedPokemon.length ? <div className="rk-grid6">{ownedPokemon.map((pokemon) => <div key={pokemon.pokemonId} className="rk-pick"><PokemonImage src={pokemon.imagePath} size={56} alt={pokemon.name} /><span>{pokemon.name}</span><span className="rk-num">전투력 {pokemon.combatPower}</span></div>)}</div> : <p className="rk-cardsub">아직 랭킹전에 사용할 수 있는 포켓몬이 없어요.</p>}</section></main>;

  return <main className="rk-inner rk-page"><div className="rk-pagehead"><div><h1 className="rk-title">전투 기록</h1><p className="rk-lede">참가 뒤 치른 공격·방어전이 여기에 기록돼요</p></div><span className="rk-badge rk-badge--warn">참가 전</span></div><div className="rk-split rk-split--log"><section className="rk-card"><span className="rk-cardtitle">점수 변화</span><p className="rk-cardsub">랭킹전 참가 후 실제 전투 결과로 점수 추이가 표시돼요.</p></section><div className="rk-statrow"><span>현재 전투 기록</span><strong>0전</strong></div></div><section className="rk-card"><span className="rk-cardtitle">아직 전투 기록이 없어요</span><p className="rk-cardsub">예시 전적은 보여주지 않아요. 참가 후 내 전투만 기록됩니다.</p>{action}</section></main>;
}

export function RankingScreen({ page, profileId, state, readOnly = false }: { page: RankingPage; profileId: string; state: RankingLeagueState | null; readOnly?: boolean }) {
  if (!state) {
    return (
      <main className="rk-inner rk-page">
        <div className="rk-card">
          <span className="rk-cardtitle">랭킹전을 준비하고 있어요</span>
          <p className="rk-cardsub">데모에서는 랭킹전을 이용할 수 없어요.</p>
        </div>
      </main>
    );
  }

  if (!state.entry) {
    return <RankingOnboarding page={page} state={state} readOnly={readOnly} />;
  }

  if (page === "home") return <HomeScreen profileId={profileId} state={state} />;
  if (page === "attack") return <AttackScreen profileId={profileId} state={state} />;
  if (page === "deck") return <DeckScreen profileId={profileId} state={state} />;
  return <LogScreen profileId={profileId} state={state} />;
}
