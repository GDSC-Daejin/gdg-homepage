# 도감 랭킹전 전투 애니메이션 정책

## 1. 목적과 범위

랭킹전의 서버 확정 결과를 짧고 이해 가능한 3:3 전투로 재생한다. 전투장만 PixiJS로 렌더링하고, 점수·전적·상세 로그·모달 제어는 기존 React UI로 유지한다.

친선 결투, 전투 규칙, 점수 계산, 전투 로그 구조는 바꾸지 않는다.

## 2. 전투장의 책임

- PixiJS는 배경, 포켓몬 스프라이트, 몬스터볼, 타입별 공격, 파티클, 카메라 흔들림만 그린다.
- React는 전투 참가자 이름, HP, 피해 수치, 타입 상성 문구, 재생 제어, 결과표와 접근 가능한 전투 로그를 표시한다.
- 서버의 `battleLog`와 저장된 승패만 재생의 입력이다. 클라이언트는 피해·승패·점수를 계산하거나 변경하지 않는다.

## 3. 재생 정책

- 전투장은 PokéRogue 화면과 같은 16:9(320×180 필드) 무대다. 장면 전체를 320×180 렌더 텍스처에 그린 뒤 최근접 보간으로 확대해 원작과 같은 픽셀 밀도로 보여준다. 포켓몬 발 위치·정보창 위치·아래 48픽셀 메시지창 배치는 원작과 같고, 내 포켓몬 발은 메시지창에 가려진다. 메시지(aria-live)·정보창은 DOM 오버레이다.
- 선공은 양쪽 몬스터볼이 맞부딪친 뒤 선공 쪽 볼이 떠오르는 연출과 "OO 파티 선공!" 문구로 보여준다.
- 전투는 선공 안내, 포켓몬 등장, 차징, 공격, 명중, HP 반영, 쓰러짐·교대, 결과 순으로 재생한다.
- 공격마다 피해 수치와 타입 상성 문구를 표시한다. 타입 보정 1.2는 `효과가 굉장했다!`, 0.8은 `효과가 별로였다…`로 안내한다.
- 사용자는 일시정지, 다시 보기, 2배속, 결과 보기(건너뛰기), 효과음 켜기/끄기를 사용할 수 있다.
- `prefers-reduced-motion`에서는 장면 전환과 피해·결과만 즉시 표시한다. 전투 결과와 상세 로그는 항상 동일하다.

## 4. 시각·성능 원칙

- 기존 픽셀풍, 타입별 효과 색상, 몬스터볼 자산을 유지한다. 타입 색·연출 계열은 `src/lib/pokedex/battle-effects.ts` 한 곳에서 정의한다.
- 포켓몬 스프라이트와 이펙트 이미지는 아래 외부 출처의 URL을 런타임에만 불러온다. 이미지·오디오 파일을 저장소(`public/` 포함)에 커밋하지 않는다. 저장소가 공개라 커밋하면 재배포가 되기 때문이다.
- 외부 이미지를 불러오지 못하면 정적 PNG와 Pixi Graphics·파티클 연출로 대체하고, 전투 재생은 멈추지 않는다.
- 효과음은 모두 아래 외부 샘플(몬스터볼·타입별 공격·명중·기절·차징·승리)을 쓰고, 불러오지 못한 소리만 Web Audio API로 코드에서 합성한다. 전투 배경음악도 외부 URL로 재생한다. 오디오 파일은 저장소에 커밋하지 않는다.
- 효과음과 배경음악은 각각 기본값 켜짐이고, 전투 모달의 토글로 따로 끌 수 있으며 선택은 브라우저에 저장한다.
- 셰이더와 새 캐릭터 일러스트는 추가하지 않는다.
- PixiJS는 전투 모달을 열 때만 불러온다. 랭킹 홈·공격·덱·기록 화면의 초기 번들에는 포함하지 않는다.
- 전투장은 한 개의 Canvas로 렌더링하고, 화면 해상도와 기기 성능에 따라 파티클 수와 렌더 해상도를 제한한다.
- WebGL 또는 텍스처 로딩에 실패하면 전투 결과와 DOM 상세 로그를 즉시 표시한다. 애니메이션 실패가 전투 기록 조회를 막아서는 안 된다.

## 5. 외부 이미지 출처

| 용도 | URL 패턴 | 비고 |
| --- | --- | --- |
| 포켓몬 정적 이미지(기존) | `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{번호}.png` | PokeAPI/sprites 저장소. 뒷모습은 `.../back/{번호}.png` |
| 포켓몬 스프라이트(우선) | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/pokemon/{번호}.json`(+`.png`), 공격 측은 `.../pokemon/back/{번호}.json` | PokéRogue 스프라이트 아틀라스, 10fps. 아틀라스 JSON은 AGPL(REUSE) — 사용자 결정으로 런타임 사용 |
| 메시지창 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/ui/bg.png` | 첫 줄(320×48)만 쓴다 |
| 포켓몬 애니메이션 | `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/{번호}.gif`, `.../showdown/back/{번호}.gif` | 공격 측은 뒷모습, 방어 측은 앞모습 |
| 전투 배경·발판 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/arenas/{배경}_bg.png`, `..._a.png`(내 발판), `..._b.png`(상대 발판) | 320×180 필드. 전투 id로 배경 9종 중 하나를 고정 선택한다 |
| 몬스터볼 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/pokeball/pb.png`, `pb_opening.png`, `pb_open.png` | 등장·회수·선공 볼 던지기에 사용 |
| 몬스터볼 방출 파티클 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/effects/pb_particles.png` | 볼이 열릴 때·선공 볼이 부딪칠 때 원형으로 퍼지는 별·빛 조각. 같은 이름의 아틀라스 JSON은 저장소 REUSE에서 AGPL로 분류돼 쓰지 않고, PNG의 불투명 픽셀 덩어리를 직접 잘라 쓴다 |
| 효과음 샘플 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/se/{pb_throw,pb_rel,hit,hit_strong,hit_weak,faint,charge,level_up_fanfare}.wav` | 저장소 REUSE.toml 기준 원작 게임에서 가져온 소리. 승리음은 level_up_fanfare |
| 타입별 공격음 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/battle_anims/{파일}` | 타입마다 대표 기술 소리 1개(예: 불꽃 Ember, 전기 Electricity1). `PRSFX-` 접두 파일은 Pokémon Reborn 팀 제작(LicenseRef-POKEMON-REBORN), 나머지는 원작 유래. 목록은 `ranking-battle-assets.ts` |
| 전투 배경음악 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/bgm/battle_trainer.mp3` | 약 2.6MB. 모달을 열고 배경음악이 켜져 있을 때만 받는다. 루프 지점 데이터(AGPL)는 쓰지 않고 파일 전체를 반복한다 |
| 기술 애니메이션 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/battle-anims/{기술}.json` | AGPL-3.0-only(REUSE "Considered code"). 타입별 목록은 `ranking-battle-assets.ts`의 `MOVE_POOLS`(36프레임 이하 공격 기술) |
| 기술 효과음 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/audio/battle_anims/{파일}` | 기술 JSON의 효과음 이벤트가 가리키는 파일. `PRSFX-` 접두는 Pokémon Reborn 팀 제작 |
| 정보창·체력바 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/ui/{pbinfo_enemy_mini,pbinfo_player,overlay_hp}.png` | REUSE 표기 없음(PokéRogue 자체 제작 추정) |
| 기술 한국어 이름 | PokeAPI 기술 데이터의 `ko` 이름 | `ranking-battle-assets.ts`에 이름만 둔다 |
| 타입 이펙트 시트 | `https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta/images/battle_anims/{파일명}.png` | 96px 셀 5열 격자. 계열 기본값과 타입별 시트(얼음·독·바위·땅·강철·격투·드래곤·비행·고스트·에스퍼·페어리·벌레)를 쓴다. 사용할 셀은 이미지를 보고 직접 골랐다. 저장소 REUSE에 별도 표기가 없다 |

- 외부 배경을 불러오지 못하면 기존 전투장 그림(`public/pokedex/effects/battle-arena.webp`)이 CSS 배경으로 보이고, 몬스터볼은 Graphics로 그린다.
- 위 주소는 모두 `access-control-allow-origin: *`로 WebGL 텍스처 로드가 가능함을 확인했다. 주소 목록은 `src/app/(member)/pokedex/ranking-battle-assets.ts`에 둔다.
- 스프라이트·이펙트 그림의 캐릭터와 디자인 권리는 Pokémon/Nintendo/Creatures/GAME FREAK에 있다. PokeAPI/sprites와 PokéRogue 에셋 저장소는 이를 모아 둔 공개 저장소이며, 정식 라이선스가 아니다. 비공개 동아리 회원 화면에서만 쓰고, 공개 배포·수익화로 범위가 바뀌면 자체·라이선스 에셋으로 교체한다([조사 문서](../research/pokemon-webgame-stack-research-2026-08-03.md)의 IP 경계 참고).
- 기술 연출: 다시 보기마다 공격 단계별로 그 타입의 PokéRogue 기술 하나를 무작위로 고르고, PokéRogue battle-anims JSON을 런타임에 받아 PokéRogue와 같은 규칙(프레임당 50ms, 대상·시전자·보간·화면 기준점, 상대 전용 변형)으로 재생한다. 공격 단계 길이는 기술 길이에 맞춘다. 배경 이벤트(타일 배경·스크롤·투명도), 포켓몬 색조, 그리는 순서(priority)도 원작대로 재생하고, 프레임 사이 위치·크기·투명도·회전은 보간해 부드럽게 보이게 한다(차이 합성 모드는 일반 합성으로 대신한다). 고른 기술 이름은 메시지 박스에 텍스트로 보여준다. 기술을 못 받으면 기존 타입별 이펙트 시트·Graphics 연출로 대체한다.
- 정보창·체력바: PokéRogue UI 이미지(pbinfo_enemy_mini, pbinfo_player, overlay_hp)를 React 정보창의 배경으로 쓰고, 이름·전투력·체력 수치·progressbar 속성은 DOM으로 유지한다.
- **라이선스 결정(2026-10-18, 사용자 결정)**: battle-anims JSON은 PokéRogue 저장소 REUSE에서 AGPL-3.0-only "코드"로 분류되고, UI 이미지(pbinfo·overlay_hp)는 별도 표기가 없어 PokéRogue 자체 제작(AGPL) 자산일 가능성이 크다. 이 저장소에는 라이선스가 없으므로 AGPL 의무(이 앱 소스를 AGPL로 제공)와 충돌할 수 있다는 위험을 알고도, 원작과 같은 연출을 위해 런타임 로드를 택했다. 파일은 저장소에 복사하지 않는다. 공개 배포·외부 공유로 범위가 바뀌면 이 결정을 다시 검토한다.
- Pokémon Showdown 클라이언트 코드는 복사하지 않는다. 몬스터볼 파티클 아틀라스 JSON(AGPL)은 쓰지 않고 PNG를 직접 자른다.

## 6. 효과음

- 공격(타입별), 명중(상성에 따라 강·보통·약), 기절, 등장(볼 던지기·열림), 결과 소리를 낸다. 공격음은 명중음과 겹치지 않게 0.9초에서 줄이고, 이번 전투에 나오는 타입의 공격음만 받는다.
- 배경음악은 재생 중에만 틀고, 일시정지하면 멈추며, 결과(건너뛰기 포함)에서는 처음으로 되감는다. 자동 재생이 막히면 무음으로 진행하고 다음 버튼 입력 때 다시 시도한다.
- AudioContext는 사용자 입력 이후에만 만든다. 일시정지하면 소리도 멈추고, 2배속이면 소리 길이도 짧아진다. 결과 보기(건너뛰기)와 `prefers-reduced-motion`에서는 재생하지 않고, 모달을 닫으면 정리한다.
- 토글은 `aria-pressed`를 가진 버튼으로 두고, 선택은 localStorage에 저장한다. 저장소 접근에 실패하면 기본값(켜짐)을 쓴다.

## 7. 접근성·운영 경계

- 재생 제어는 키보드로 조작 가능한 버튼과 보이는 포커스를 제공한다.
- 피해·교대·결과는 Canvas에만 남기지 않고 텍스트 상태로도 제공한다.
- 포켓몬 텍스처에 쓰는 외부 이미지의 CORS 가능 여부를 도입 전에 확인한다. 불가능할 때만 별도 자산 제공 방식을 결정한다.
- 효과 강도와 시간은 운영 데이터·회원 피드백을 본 뒤 조정한다. 전투 규칙을 바꾸기 위한 수단으로 애니메이션을 사용하지 않는다.
