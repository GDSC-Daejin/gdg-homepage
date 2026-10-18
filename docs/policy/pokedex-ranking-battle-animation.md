# 도감 랭킹전 전투 애니메이션 정책

## 1. 목적과 범위

랭킹전의 서버 확정 결과를 짧고 이해 가능한 3:3 전투로 재생한다. 전투장만 PixiJS로 렌더링하고, 점수·전적·상세 로그·모달 제어는 기존 React UI로 유지한다.

친선 결투, 전투 규칙, 점수 계산, 전투 로그 구조는 바꾸지 않는다.

## 2. 전투장의 책임

- PixiJS는 배경, 포켓몬 스프라이트, 몬스터볼, 타입별 공격, 파티클, 카메라 흔들림만 그린다.
- React는 전투 참가자 이름, HP, 피해 수치, 타입 상성 문구, 재생 제어, 결과표와 접근 가능한 전투 로그를 표시한다.
- 서버의 `battleLog`와 저장된 승패만 재생의 입력이다. 클라이언트는 피해·승패·점수를 계산하거나 변경하지 않는다.

## 3. 재생 정책

- 전투장은 16:9 무대다. 상대 정보는 왼쪽 위, 내 정보는 오른쪽 아래에 둔다.
- 선공은 양쪽 몬스터볼이 맞부딪친 뒤 선공 쪽 볼이 떠오르는 연출과 "OO 파티 선공!" 문구로 보여준다.
- 전투는 선공 안내, 포켓몬 등장, 차징, 공격, 명중, HP 반영, 쓰러짐·교대, 결과 순으로 재생한다.
- 공격마다 피해 수치와 타입 상성 문구를 표시한다. 타입 보정 1.2는 `효과가 굉장했다!`, 0.8은 `효과가 별로였다…`로 안내한다.
- 사용자는 일시정지, 다시 보기, 2배속, 결과 보기(건너뛰기), 효과음 켜기/끄기를 사용할 수 있다.
- `prefers-reduced-motion`에서는 장면 전환과 피해·결과만 즉시 표시한다. 전투 결과와 상세 로그는 항상 동일하다.

## 4. 시각·성능 원칙

- 기존 픽셀풍, 타입별 효과 색상, 몬스터볼 자산을 유지한다. 타입 색·연출 계열은 `src/lib/pokedex/battle-effects.ts` 한 곳에서 정의한다.
- 포켓몬 스프라이트와 이펙트 이미지는 아래 외부 출처의 URL을 런타임에만 불러온다. 이미지·오디오 파일을 저장소(`public/` 포함)에 커밋하지 않는다. 저장소가 공개라 커밋하면 재배포가 되기 때문이다.
- 외부 이미지를 불러오지 못하면 정적 PNG와 Pixi Graphics·파티클 연출로 대체하고, 전투 재생은 멈추지 않는다.
- 효과음은 Web Audio API로 코드에서 합성한다(오디오 파일 없음). 기본값은 켜짐이고, 전투 모달의 토글로 끌 수 있으며 선택은 브라우저에 저장한다.
- 셰이더와 새 캐릭터 일러스트는 추가하지 않는다.
- PixiJS는 전투 모달을 열 때만 불러온다. 랭킹 홈·공격·덱·기록 화면의 초기 번들에는 포함하지 않는다.
- 전투장은 한 개의 Canvas로 렌더링하고, 화면 해상도와 기기 성능에 따라 파티클 수와 렌더 해상도를 제한한다.
- WebGL 또는 텍스처 로딩에 실패하면 전투 결과와 DOM 상세 로그를 즉시 표시한다. 애니메이션 실패가 전투 기록 조회를 막아서는 안 된다.

## 5. 외부 이미지 출처

| 용도 | URL 패턴 | 비고 |
| --- | --- | --- |
| 포켓몬 정적 이미지(기존) | `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{번호}.png` | PokeAPI/sprites 저장소. 뒷모습은 `.../back/{번호}.png` |
| 포켓몬 애니메이션 | `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/{번호}.gif`, `.../showdown/back/{번호}.gif` | 공격 측은 뒷모습, 방어 측은 앞모습 |
| 전투 배경·발판 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/arenas/{배경}_bg.png`, `..._a.png`(내 발판), `..._b.png`(상대 발판) | 320×180 필드. 전투 id로 배경 9종 중 하나를 고정 선택한다 |
| 몬스터볼 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/pokeball/pb.png`, `pb_opening.png`, `pb_open.png` | 등장·회수·선공 볼 던지기에 사용 |
| 타입 이펙트 시트 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/battle_anims/{파일명}.png` | 96px 셀 5열 격자. 사용할 셀은 이미지를 보고 직접 골랐다 |

- 외부 배경을 불러오지 못하면 기존 전투장 그림(`public/pokedex/effects/battle-arena.webp`)이 CSS 배경으로 보이고, 몬스터볼은 Graphics로 그린다.
- 위 주소는 모두 `access-control-allow-origin: *`로 WebGL 텍스처 로드가 가능함을 확인했다. 주소 목록은 `src/app/(member)/pokedex/ranking-battle-assets.ts`에 둔다.
- 스프라이트·이펙트 그림의 캐릭터와 디자인 권리는 Pokémon/Nintendo/Creatures/GAME FREAK에 있다. PokeAPI/sprites와 PokéRogue 에셋 저장소는 이를 모아 둔 공개 저장소이며, 정식 라이선스가 아니다. 비공개 동아리 회원 화면에서만 쓰고, 공개 배포·수익화로 범위가 바뀌면 자체·라이선스 에셋으로 교체한다([조사 문서](../research/pokemon-webgame-stack-research-2026-08-03.md)의 IP 경계 참고).
- PokéRogue의 battle-anims 데이터(AGPL)와 Pokémon Showdown 클라이언트 코드는 복사하지 않는다. 볼 투척 → 등장, 차징 → 발사 → 히트스톱 → 넉백, HP 감소 속도 같은 연출 타이밍과 구성만 참고한다.

## 6. 효과음

- 공격(계열별), 명중(상성에 따라 강·보통·약), 기절, 등장, 결과 소리를 합성한다.
- AudioContext는 사용자 입력 이후에만 만든다. 일시정지하면 소리도 멈추고, 2배속이면 소리 길이도 짧아진다. 결과 보기(건너뛰기)와 `prefers-reduced-motion`에서는 재생하지 않고, 모달을 닫으면 정리한다.
- 토글은 `aria-pressed`를 가진 버튼으로 두고, 선택은 localStorage에 저장한다. 저장소 접근에 실패하면 기본값(켜짐)을 쓴다.

## 7. 접근성·운영 경계

- 재생 제어는 키보드로 조작 가능한 버튼과 보이는 포커스를 제공한다.
- 피해·교대·결과는 Canvas에만 남기지 않고 텍스트 상태로도 제공한다.
- 포켓몬 텍스처에 쓰는 외부 이미지의 CORS 가능 여부를 도입 전에 확인한다. 불가능할 때만 별도 자산 제공 방식을 결정한다.
- 효과 강도와 시간은 운영 데이터·회원 피드백을 본 뒤 조정한다. 전투 규칙을 바꾸기 위한 수단으로 애니메이션을 사용하지 않는다.
