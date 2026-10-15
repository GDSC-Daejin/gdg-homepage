# 도감 랭킹전 PixiJS 하이브리드 전투장 구현 계획

## 목표

기존 랭킹전 모달 안의 CSS/Canvas 전투장을 PixiJS 전투장으로 바꾼다. 시각적 재생은 게임처럼 만들되, 서버 확정 결과와 기존 React 결과표·접근 가능한 로그는 그대로 유지한다.

## 인수 조건

- 전투 모달을 열면 선공, 등장, 공격, 피해, 쓰러짐·교대, 결과가 저장된 `battleLog` 순서대로 재생된다.
- 타입별 공격과 명중 효과가 달라지고, 공격 직전에 짧은 차징이 보인다.
- 일시정지·다시 보기·2배속·결과 보기 버튼이 동작한다.
- 모션 감소 설정 또는 PixiJS 초기화 실패 시 결과와 DOM 전투 로그를 즉시 읽을 수 있다.
- 일반 랭킹 화면은 PixiJS를 내려받지 않는다.
- 승패·피해·점수 계산 및 DB/RPC 변경은 없다.

## 구조

`RankingBattleAnimation`은 React의 제어·상태·HUD·결과표를 유지한다. 새 `PixiRankingBattleScene`은 전투 모달에서만 PixiJS를 동적으로 불러 한 Canvas에 장면을 그린다.

```text
battleLog (서버 저장값)
        ↓
RankingBattleAnimation ── 재생 제어 · HP/피해 HUD · 텍스트 로그
        ↓
PixiRankingBattleScene ── 배경 · 스프라이트 · 타입 이펙트 · 카메라
```

PixiJS의 ticker는 현재 재생 위치와 배속만 진행한다. 각 턴의 경계에서 React HUD를 갱신한다. CSS 타이머 배열과 별도의 전투 결과 상태는 만들지 않는다.

## 작업 순서

1. **의존성·로드 경계**
   - `pixi.js`를 추가한다.
   - `PixiRankingBattleScene` 내부 `useEffect`에서만 동적 import한다.
   - 기존 `RankingBattleAnimation`의 렌더 호출부(랭킹 패널, 공격 화면, 기록 화면)는 바꾸지 않는다.
   - 확인: 전투 모달을 열기 전 production chunk에 PixiJS가 포함되지 않는다.

2. **기본 장면**
   - 기존 전투장 자산과 포켓몬 이미지를 Pixi texture로 불러 배경·양측 포켓몬·몬스터볼 레이어를 만든다.
   - 차징, 발사, 명중, 피격, 쓰러짐, 회수, 교대를 한 턴 시퀀스로 만든다.
   - 기존 `PixelBattleEffect`의 타입 팔레트와 공격 효과를 Pixi 장면으로 옮기되, 타입 규칙은 재사용하고 중복 정의하지 않는다.
   - 확인: 선공·공격자·방어자·교대가 각 `battleLog`의 인덱스와 일치한다.

3. **HUD·재생 제어**
   - React 쪽에 HP, 피해량, 상성 문구, 현재 턴, 일시정지·다시 보기·2배속·결과 보기 버튼을 둔다.
   - 건너뛰기는 마지막 장면과 결과표를 즉시 표시하며, 서버 데이터는 다시 요청하지 않는다.
   - 확인: 재생 중 버튼을 반복 클릭해도 타임라인이 중복 시작되지 않는다.

4. **대체 경로와 성능**
   - 모션 감소 설정에서는 애니메이션 ticker를 시작하지 않고 HUD와 결과표를 즉시 표시한다.
   - Pixi 초기화·이미지 로딩 실패 시 Canvas를 숨기고 기존 DOM 상세 로그를 표시한다.
   - 모바일에서는 Canvas 해상도와 파티클 수를 낮춘다.
   - 확인: 모바일과 데스크톱에서 전투 시작·교대·결과·닫기 흐름을 수동 점검한다.

5. **검증**
   - `tests/pokedex-ranking-pixi-scene.test.ts`에 저장된 전투 로그 순서, 모션 감소, 재생 제어의 소스 계약을 추가한다.
   - `pnpm test`로 랭킹전 관련 테스트를 실행하고, `pnpm exec tsc --noEmit`, `pnpm build`를 실행한다.
   - 동일한 전투 기록으로 기존과 새 장면의 승패·점수·턴 수가 같음을 확인한다.

## 변경 대상

- `package.json`, `pnpm-lock.yaml`
- `src/app/(member)/pokedex/RankingBattleAnimation.tsx`
- `src/app/(member)/pokedex/PixiRankingBattleScene.tsx`
- 필요 시 `src/app/(member)/pokedex/DuelPanel.module.css`
- `tests/pokedex-ranking-pixi-scene.test.ts`

## 제외 범위

- 전투 규칙·점수·DB·RPC 변경
- 친선 결투 전환
- 신규 캐릭터 일러스트, 오디오, WebGPU 전용 렌더러, 전체 화면 게임 모드
- PixiJS 외 애니메이션 라이브러리 추가

## 오픈 결정

외부 포켓몬 이미지가 WebGL 텍스처로 안정적으로 로딩되는지만 구현 착수 전에 확인한다. 실패하면 자산 제공 방식 결정을 먼저 받고, 그 외에는 이 계획대로 진행한다.
