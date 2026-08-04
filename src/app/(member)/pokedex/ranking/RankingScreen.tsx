"use client";

import Link from "next/link";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { AttackScreen } from "./AttackScreen";
import { DeckScreen } from "./DeckScreen";
import { HomeScreen } from "./HomeScreen";
import { LogScreen } from "./LogScreen";

export type RankingPage = "home" | "attack" | "deck" | "log";


/**
 * 랭킹전 4페이지 본문. 상태가 없거나 참전 전인 경우를 여기서 걸러내고,
 * 나머지는 각 화면으로 넘긴다. 원본 시안은 /ranking-preview 참고.
 */
export function RankingScreen({ page, profileId, state }: { page: RankingPage; profileId: string; state: RankingLeagueState | null }) {
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
    return (
      <main className="rk-inner rk-page">
        <div className="rk-card">
          <span className="rk-cardtitle">랭킹전에 참전하지 않았어요</span>
          <p className="rk-cardsub">서로 다른 포켓몬 6종을 모으면 3:3 랭킹전에 도전할 수 있어요.</p>
          <Link href="/pokedex?tab=ranking" style={{ fontSize: 13, fontWeight: 700, color: "var(--rk-primary)" }}>
            랭킹전 안내 보기
          </Link>
        </div>
      </main>
    );
  }

  if (page === "home") return <HomeScreen profileId={profileId} state={state} />;
  if (page === "attack") return <AttackScreen profileId={profileId} state={state} />;
  if (page === "deck") return <DeckScreen profileId={profileId} state={state} />;
  return <LogScreen profileId={profileId} state={state} />;
}
