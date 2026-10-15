# Project Rules

이 저장소는 루트가 Next.js 16.2.10 앱이며 React 19, TypeScript, Vitest를 사용한다.

## 작업 시작

- 목표를 관찰 가능한 인수 조건으로 정리한다.
- 기존 구현·호출부·테스트를 먼저 확인하고, 변경과 관련된 문서만 읽는다.
- 프론트 변경은 docs/frontend/의 관련 문서를 확인한다.
- Next.js API나 동작이 불확실하면 설치된 node_modules/next/dist/docs/의 해당 가이드를 우선한다.
- 업무 의미·권한·호환성이 불명확한 경우에만 질문하고, 구현 방법과 테스트 경계는 에이전트가 정한다.

## 규칙 강도

MUST는 조건에 해당하면 필수다. DEFAULT는 특별한 이유가 없으면 따른다. CONSIDER는 현재 문제나 요구가 있을 때만 검토한다. 권장 패턴과 실제 기능·보안·접근성 요구를 혼동하지 않는다.

## MUST — 보호할 경계

- 비밀값을 코드·로그·테스트 결과에 노출하지 않는다.
- 서버 전용 코드·환경변수와 브라우저 전용 실행의 경계를 지킨다. Server → Client props는 직렬화 가능한 값만 전달한다.
- 신뢰 경계의 입력을 검증하고, 오류·권한 거부·데이터 정합성 문제를 숨기지 않는다.
- 의미 있는 HTML, 레이블, 키보드 조작, 포커스 등 접근성 기본을 지킨다.
- 기존 사용자 변경과 작업 중인 변경을 보존한다. 업무와 무관한 정리나 공유 데이터 삭제를 하지 않는다.
- 변경된 행동과 관련 실패 경로를 실행해 검증한다. 검증하지 않은 완료를 주장하지 않는다.

## DEFAULT — 구현 출발점

- 요청을 충족하는 최소 변경을 한다. 기존 src/components, src/actions, src/lib과 기존 UI 패턴을 먼저 재사용한다.
- App Router와 Server Component를 기본으로 사용하고, 상태·이벤트·브라우저 API가 필요한 최소 영역에만 Client 경계를 둔다.
- 현재 구조를 FSD 모양으로 맞추기 위해 파일을 일괄 이동하지 않는다. 실제 공유·복잡도가 생길 때만 새 레이어를 추가한다.
- 내부 이동은 next/link를, 화면 이미지는 next/image를 우선한다.
- 현재 props/state로 계산할 수 있는 값을 별도 state와 Effect로 복제하지 않는다.
- 변경 전 관련 호출부를 확인하고 공통 원인이면 공유 경계에서 한 번 고친다.

## CONSIDER — 필요할 때만 선택

- compound component, Context, 전역 store, dynamic import, Suspense 세분화, 전역 progress UI, memoization은 실제 복잡도·병목·공유 상태가 있을 때만 도입한다.
- 성능 개선을 주장할 때는 같은 화면·데이터·실행 조건의 전후 측정값을 남긴다.
- 추가 스킬이나 병렬 검토는 현재 복잡도와 검증할 위험이 있을 때만 사용한다.

## 검증

- 타입 검사: pnpm exec tsc --noEmit
- 테스트: pnpm test
- 프로덕션 빌드: pnpm build
- 개발 서버: pnpm dev
- 문서만 변경한 경우 링크·경로·명령 일치와 git diff --check를 확인한다. 애플리케이션 빌드·테스트를 문서 검증의 필수 조건으로 만들지 않는다.
- tests/accessibility-primitives.test.ts는 eslint deps/script를 단언하지만 eslint가 설치되지 않아 클린 트리에서도 실패한다. 이 known failure를 package.json 변경으로 고치지 않는다.
- 실패·건너뜀·미실행·flaky를 통과로 보고하지 않는다. 기존 실패와 환경 오류는 제품 오류와 구분해 원문과 함께 보고한다.
- 사용자 상호작용 변경은 화면 표시만으로 통과시키지 말고 실제 입력·클릭·이동 결과를 확인한다.

## 프로젝트별 절차

- 이슈 트래커는 Linear `gdg-dju` 워크스페이스의 `GDG` 팀(https://linear.app/gdg-dju/team/GDG/overview)이다. 접근은 `.mcp.json`의 `linear` MCP 서버를 쓴다. 이슈는 [docs/linear-issue-templates.md](docs/linear-issue-templates.md)의 템플릿으로, PR 본문은 [.github/pull_request_template.md](.github/pull_request_template.md)로 쓴다.
- 테스트 포켓몬 수동 출현 요청은 docs/pokedex-bot-setup.md의 해당 절차를 따른다.
- 커밋·push·merge·배포는 사용자의 승인 없이 수행하지 않는다.
