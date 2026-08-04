"use client";

import { useEffect, useState, useTransition } from "react";
import { activateRankingAttack, activateRankingDefense, saveRankingPreset } from "@/actions/pokedex-ranking";
import { deckSuggestions } from "@/lib/pokedex/deck-suggestions";
import type { RankingLeagueState } from "@/lib/pokedex/ranking-league";
import { toggleRankingPresetMember } from "@/lib/pokedex/ranking-stats";
import { PokemonImage } from "./parts";

type DeckKind = "attack" | "defense";
const LABEL: Record<DeckKind, string> = { defense: "방어 덱", attack: "공격 덱" };

export function DeckScreen({ state }: { profileId: string; state: RankingLeagueState }) {
  const entry = state.entry!;
  const [editing, setEditing] = useState<DeckKind>(entry.activeDefenseSlot === null ? "defense" : "attack");
  const [slots, setSlots] = useState<Record<DeckKind, number>>({
    defense: entry.activeDefenseSlot ?? 1,
    attack: entry.activeAttackSlot ?? 1,
  });
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const slot = slots[editing];
  const saved = state.presets.find((preset) => preset.kind === editing && preset.slot === slot)?.members ?? [];
  const savedIds = saved.map((member) => member.throwId).join(",");

  // 편집 대상이 바뀌면 저장된 구성을 다시 불러온다.
  useEffect(() => setDraft(savedIds ? savedIds.split(",") : []), [savedIds, editing, slot]);

  const dirty = draft.join(",") !== savedIds;
  const isActive = editing === "defense" ? entry.activeDefenseSlot === slot : entry.activeAttackSlot === slot;
  const power = draft.reduce((total, id) => total + (state.ownedPokemon.find((pokemon) => pokemon.throwId === id)?.combatPower ?? 0), 0);
  const suggestions = deckSuggestions(state.ownedPokemon, editing);

  function run(task: () => Promise<{ error?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const result = await task();
      if (result.error) setError(result.error);
    });
  }

  return (
    <main className="rk-inner rk-page">
      <div className="rk-pagehead">
        <div>
          <h1 className="rk-title">내 덱</h1>
          <p className="rk-lede">방어 덱은 다음 날 06:00부터, 공격 덱은 저장 즉시 적용돼요</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="rk-badge rk-badge--primary">{LABEL[editing]} {slot}번 편집 중</span>
          <button
            type="button"
            className="rk-btn rk-btn--outline"
            disabled={pending || draft.length !== 3 || !dirty}
            onClick={() => run(() => saveRankingPreset(editing, slot, draft))}
          >
            {dirty ? "변경사항 저장" : "저장됨"}
          </button>
          <button
            type="button"
            className="rk-btn rk-btn--solid"
            disabled={pending || draft.length !== 3 || dirty || isActive}
            onClick={() => run(() => (editing === "defense" ? activateRankingDefense(slot) : activateRankingAttack(slot)))}
          >
            {isActive ? "마이 파티" : "마이 파티로 지정"}
          </button>
        </div>
      </div>

      <div className="rk-grid2">
        {(["defense", "attack"] as DeckKind[]).map((kind) => {
          const active = editing === kind;
          const activeSlot = kind === "defense" ? entry.activeDefenseSlot : entry.activeAttackSlot;
          const members = active ? draft.map((id) => state.ownedPokemon.find((pokemon) => pokemon.throwId === id)!).filter(Boolean)
            : state.presets.find((preset) => preset.kind === kind && preset.slot === slots[kind])?.members ?? [];
          return (
            <div key={kind} className="rk-card" style={{ padding: 20, gap: 16, borderColor: active ? "var(--rk-primary)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.025em", whiteSpace: "nowrap" }}>{LABEL[kind]}</span>
                  <span className={`rk-badge ${activeSlot === slots[kind] ? "rk-badge--pos" : "rk-badge--warn"}`}>
                    {activeSlot === slots[kind] ? "마이 파티" : activeSlot ? `${activeSlot}번이 활성` : "미설정"}
                  </span>
                  {!active && <button type="button" className="rk-link" onClick={() => setEditing(kind)}>이 덱 편집</button>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11.5, color: "var(--rk-text-2)" }}>프리셋</span>
                  {[1, 2, 3].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`rk-slotchip${slots[kind] === value ? " is-on" : ""}`}
                      aria-pressed={slots[kind] === value}
                      onClick={() => { setSlots((current) => ({ ...current, [kind]: value })); setEditing(kind); }}
                    >
                      {value}
                      {activeSlot === value && <span className="sr-only"> 마이 파티</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rk-slots">
                {[0, 1, 2].map((index) => {
                  const pokemon = members[index];
                  if (!pokemon) return <div key={index} className="rk-slot rk-slot--empty"><span style={{ fontSize: 18 }}>+</span></div>;
                  return (
                    <button
                      key={pokemon.throwId}
                      type="button"
                      className="rk-slot"
                      disabled={!active}
                      onClick={() => setDraft((current) => current.filter((id) => id !== pokemon.throwId))}
                    >
                      <span className="rk-order">{index + 1}</span>
                      <PokemonImage src={pokemon.imagePath} size={52} alt={pokemon.name} />
                      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{pokemon.name}</span>
                      <span className="rk-num" style={{ fontSize: 11, fontWeight: 600, color: "var(--rk-primary-heavy)" }}>{pokemon.combatPower}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 2 }}>
                <span className="rk-num" style={{ fontSize: 12, color: "var(--rk-text-2)" }}>
                  합산 {(active ? power : members.reduce((total, pokemon) => total + pokemon.combatPower, 0)).toLocaleString()}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--rk-text-1)" }}>{members.length}/3</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rk-rule" />

      <div className="rk-split rk-split--deck">
        <div className="rk-card">
          <div className="rk-cardhead">
            <div>
              <span className="rk-cardtitle">보유 포켓몬 {state.ownedPokemon.length}</span>
              <p className="rk-cardsub">누르면 {LABEL[editing]} {slot}번에 넣어요 — 3마리까지</p>
            </div>
          </div>
          <div className="rk-grid6">
            {state.ownedPokemon.map((pokemon) => {
              const order = draft.indexOf(pokemon.throwId);
              return (
                <button
                  key={pokemon.throwId}
                  type="button"
                  className="rk-pick"
                  aria-pressed={order >= 0}
                  onClick={() => setDraft((current) => toggleRankingPresetMember(current, pokemon.throwId))}
                >
                  {order >= 0 && <span className="rk-order">{order + 1}</span>}
                  <PokemonImage src={pokemon.imagePath} size={56} alt={pokemon.name} style={{ opacity: order >= 0 ? 1 : 0.5 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{pokemon.name}</span>
                  <span className="rk-num" style={{ fontSize: 11, color: "var(--rk-text-2)" }}>전투력 {pokemon.combatPower}</span>
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 11.5, color: "var(--rk-text-2)", lineHeight: 1.5 }}>
            같은 종은 중복할 수 없고 전설·환상은 한 마리만 넣을 수 있어요
          </span>
        </div>

        <div className="rk-card">
          <div>
            <span className="rk-cardtitle">추천 조합</span>
            <p className="rk-cardsub">내 포켓몬과 전투 규칙만 보고 골랐어요 · 오늘 상대는 참고하지 않아요</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggestions.map((suggestion) => (
              <div key={suggestion.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, border: "1px solid var(--rk-line-soft)" }}>
                <div style={{ display: "flex", gap: 2, flex: "none" }}>
                  {suggestion.members.map((pokemon) => <PokemonImage key={pokemon.throwId} src={pokemon.imagePath} size={36} alt={pokemon.name} />)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.01em" }}>{suggestion.title}</span>
                  <span className="rk-num" style={{ fontSize: 11.5, color: "var(--rk-text-2)" }}>합산 {suggestion.power.toLocaleString()} · {suggestion.note}</span>
                </div>
                <button type="button" className="rk-btn rk-btn--outline" onClick={() => setDraft(suggestion.members.map((pokemon) => pokemon.throwId))}>적용</button>
              </div>
            ))}
            {suggestions.length === 0 && <p className="rk-cardsub">포켓몬을 3마리 이상 모으면 조합을 추천해드려요.</p>}
          </div>
        </div>
      </div>

      {error && <p role="alert" style={{ fontSize: 13, color: "var(--rk-neg-fg)" }}>{error}</p>}
    </main>
  );
}
