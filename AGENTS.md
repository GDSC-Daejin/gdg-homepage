<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

- 사용자가 영어로 입력하거나 음성으로 말해도 항상 한국어로 응답한다.
- **알려진 상시 실패:** `tests/accessibility-primitives.test.ts`는 eslint deps/script를 단언하는데 eslint가 미설치라 클린 트리에서도 실패한다. 회귀 아님 — `package.json` 건드려 "고치지" 말 것.
- 검증 전용 작업(diff·test·build·grep)을 위임받으면 나열된 명령만 실행하고 파일을 수정하지 않는다. 실패는 원문 그대로 보고.
- UI 리디자인은 [docs/ai-redesign-workflow-general.md](docs/ai-redesign-workflow-general.md)를 따른다. 이건 **기존 화면을 고치는** 절차다 — 아직 없는 것의 방향을 정할 땐 `/prototype`.
- 웹 브라우징은 내장 브라우저(`mcp__Claude_Browser__*`). `mcp__claude-in-chrome__*` 금지.
- 사용자가 테스트 포켓몬 출현을 요청하면 [docs/pokedex-bot-setup.md](docs/pokedex-bot-setup.md)의 `테스트 포켓몬 수동 출현` 절차를 따라 즉시 처리한다.
