# 웹 크리처 배틀 게임 스택·에셋 조사

- 작성일: 2026-08-03
- 범위: 공개 배포하는 2D 턴제 크리처 배틀 웹게임. 프레임워크·멀티플레이·기존 Supabase 연계·Pokémon IP 사용 경계의 공식 문서만 확인했다.

## 결론

**공개 서비스는 `Next.js + TypeScript + Phaser + Colyseus + 기존 Supabase`가 가장 적은 전환 비용으로 적합하다.** Phaser가 전투 연출을, Colyseus가 권위 있는 실시간 전투 판정·매칭을, Supabase가 기존 로그인·보유 크리처·랭크의 원본 데이터와 권한 제어를 담당한다.

처음부터 실시간 액션을 만들 필요가 없다면 Colyseus는 빼고, Supabase RPC에서 턴 제출·타이머 만료·결과 확정을 처리하는 **비동기 턴제**로 시작한다. 실시간 PvP가 확정될 때만 Colyseus를 추가한다.

## 권장 구성

| 역할 | 선택 | 이유 |
| --- | --- | --- |
| 게임 웹·메뉴·계정 화면 | Next.js + TypeScript | 현 서비스와 같은 웹 기술로 별도 저장소를 만들 수 있다. |
| 2D 전투 화면·스프라이트·카메라·애니메이션 | Phaser | 씬이 로딩·메뉴·전투·UI 오버레이 같은 논리 단위이며, 입력·트윈·카메라·로더를 씬 단위로 제공한다. 턴제 전투 화면에 필요한 범위가 이미 있다. |
| 실시간 PvP 판정·매칭 | Colyseus (Node.js/TypeScript) | 서버 권위(authoritative) 상태 동기화와 매칭을 제공한다. 기술 선택·난수·턴 타이머·승패·랭크 반영을 여기서만 확정한다. |
| 계정·기존 보유 데이터·랭크 기록 | 기존 Supabase Auth/Postgres | Auth는 JWT와 RLS를 결합하고, Postgres의 기존 유저/보유 크리처 데이터를 계속 원본으로 쓸 수 있다. |
| 대기실 참가 표시·비핵심 알림 | Supabase Realtime | Broadcast는 저지연 이벤트, Presence는 접속 상태에 맞는다. 승패·랭크의 권위 있는 판정에는 쓰지 않는다. |

```text
브라우저: Next.js UI + Phaser 전투 연출
                  │ 선택한 기술 / 준비 신호
                  ▼
       Colyseus 게임 서버 (유효성·난수·타이머·승패)
                  │ 검증된 결과만 기록
                  ▼
  기존 Supabase (Auth, 보유 크리처, 랭크, RLS)
```

게임 서버는 사용자가 요청한 기술만 보내게 하고, 보유 여부·쿨다운·턴 순서·난수·랭크 변동을 서버에서 검증한다. 클라이언트는 결과를 애니메이션으로 재생할 뿐이다.

## 대안과 제외

- **PixiJS**는 WebGL/WebGPU 2D 렌더러다. 게임 루프·씬·전투용 도구를 직접 조합할 이유가 있을 때만 Phaser 대신 고른다. 이 게임에는 Phaser 쪽이 더 작다.
- **Godot**도 웹 내보내기는 가능하지만 WebAssembly·WebGL 2가 필요하고, Godot 4 C# 프로젝트는 웹으로 내보낼 수 없다. 현재 Next.js/TypeScript 데이터 서비스와 별도 엔진 워크플로를 동시에 운영할 이득이 없으므로 1차 선택에서 제외한다.
- Colyseus의 자체 Auth 모듈은 현재 beta다. 새 인증 체계를 만들지 말고 기존 Supabase JWT를 검증해 계정을 연결한다.

## Pokémon 원작 에셋/IP 경계

### 공개 배포 게임

Pokémon 공식 지원은 캐릭터·이름·디자인을 포함한 Pokémon IP를 프로젝트에 사용하거나 연관 짓지 말라고 명시한다. 따라서 **원작 포켓몬 이름, 캐릭터 디자인, 스프라이트, 공식 일러스트, 음악, 로고, 도감 데이터**를 공개 게임에 넣는 선택지는 제외한다. 유사한 감각은 자체 세계관·자체 크리처·자체 이름과, 직접 제작하거나 상업 사용권을 확보한 2D 스프라이트·애니메이션·효과음으로 만든다.

### 인증된 동아리 내부 팬 게임

로그인한 동아리 구성원만 쓰고, 비영리이며, 공개 마케팅·외부 배포를 하지 않으면 실제 노출과 상업적 혼동의 가능성은 낮아진다. 그러나 이는 **실무상 위험도 차이일 뿐 정식 IP 라이선스가 아니다.** 공식 안내는 프로젝트에 Pokémon IP를 사용하거나 연관 짓지 말라고 한다. 이후 공개 서비스·외부 배포·수익화 가능성이 조금이라도 있으면 처음부터 자체/라이선스 에셋을 쓰는 편이 교체 비용이 가장 작다. 실제 허가 여부는 권리자와 법률 검토가 필요한 사항이다.

## 최소 출시 순서

1. 원본 Pokémon 의존성을 끊은 **오리지널 크리처 2종, 기술 4개, 1:1 비동기 턴제**를 Phaser와 Supabase RPC로 만든다.
2. 기존 서비스 데이터는 읽기 전용으로 연결하고, 게임 결과 전용 테이블과 RPC만 추가한다.
3. 실시간 매칭·동시 접속 대전을 실제로 출시할 때 Colyseus를 붙인다.

## 공식 출처

- [Phaser 소개](https://docs.phaser.io/) — 웹 중심 2D 프레임워크, JavaScript/TypeScript 지원
- [Phaser Scenes](https://docs.phaser.io/phaser/concepts/scenes) — 씬의 전투·메뉴·UI 분리와 입력·트윈·카메라·로더 범위
- [PixiJS 렌더러](https://pixijs.com/8.x/guides/components/renderers) — WebGL/WebGPU 2D 렌더러 및 프로덕션에서는 WebGL 권장
- [Godot 웹 내보내기](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) — WebAssembly/WebGL 2 요건과 C# 웹 내보내기 제한
- [Colyseus 소개](https://docs.colyseus.io/) — 권위 있는 Node.js 게임 서버, 상태 동기화·매칭·배포
- [Colyseus Auth Module](https://docs.colyseus.io/auth/module) — Auth 모듈 beta 상태
- [Supabase Auth](https://supabase.com/docs/guides/auth) — JWT, Postgres, RLS 연계
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — 브라우저 데이터 접근에서 RLS 활성화 요구
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) — Broadcast·Presence·멀티플레이 활용 범위
- [Pokémon Support: 이미지·자료 사용](https://support.pokemon.com/hc/en-us/articles/360000634094-Can-I-use-Pok%C3%A9mon-images-or-materials) — 캐릭터·이름·디자인을 포함한 IP를 프로젝트에 쓰거나 연관 짓지 말라는 공식 안내
- [Nintendo IP & Piracy FAQ](https://en-americas-support.nintendo.com/app/answers/detail/a_id/55888/~/intellectual-property-%26-piracy-faq) — Pokémon이 상표이며 게임 시각물·음악·캐릭터 등 저작권 보호 대상이라는 설명
