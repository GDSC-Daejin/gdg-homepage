# 프론트엔드 폴더 구조

현재 프로젝트는 Next.js App Router의 route 중심 구조다. FSD 폴더 모양을 맞추기 위해 기존 코드를 일괄 이동하지 않는다.

## 현재 구조

src/

- app/: 라우팅, page/layout, 전역 스타일, 화면별 컴포넌트와 서버 조합
- components/: 여러 route에서 재사용하는 UI, board·wds 등 공용 묶음
- actions/: 서버 액션과 사용자 행동의 서버 경계
- lib/: 인증, Supabase, 외부 연동, 도메인 로직, 공용 유틸

public/은 URL로 직접 참조하는 정적 asset을 둔다. tests/는 Vitest 테스트를 둔다.

## 배치 기준

- 새 route 코드는 해당 src/app 경로에 둔다.
- 특정 route에서만 쓰는 UI는 해당 route 폴더에 둔다.
- 여러 route에서 실제로 공유되는 UI만 src/components에 둔다.
- 서버 경계나 외부 연동은 기존 src/actions·src/lib 패턴을 먼저 따른다.
- 여러 기능에서 공유되는 도메인 개념이 생길 때만 별도 레이어를 검토한다.
- 폴더를 늘리는 것보다 기존 파일의 책임과 의존 방향을 먼저 확인한다.

## 의존 방향

route 조합은 하위 공용 코드인 components·actions·lib을 사용할 수 있다. 공용 코드는 특정 route 화면을 역으로 import하지 않는다. 실제 공용 개념이 아닌 코드를 규칙 충족만을 위해 옮기지 않는다.
