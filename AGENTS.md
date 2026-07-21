<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI Redesign Workflow

For UI redesign work, follow [docs/ai-redesign-workflow-general.md](docs/ai-redesign-workflow-general.md): agree on a reference before implementation, preserve functionality and data contracts, and extract only reusable visual rules into the existing design system.

## Agent verification discipline

When delegated a **verification-only** task (diff review, test, build, grep):

- Run **only** the listed commands. Don't run `lint` or anything not asked for.
- **Do not modify any file.** If something looks like it needs fixing, report it as text — don't fix it.
- On a test/build failure, **stop and report it verbatim.** Don't try to fix it. Any failure unrelated to the diff you were given is pre-existing and out of scope.
- Time box: if a step needs installing dependencies or exceeds ~5 min, stop and report.

**Known pre-existing failure:** `tests/accessibility-primitives.test.ts` asserts eslint deps/script in `package.json`, but eslint is not installed — this test fails on a clean tree and is **not** a regression. Don't "fix" it by editing `package.json`.

## gstack

- Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
- Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /document-generate, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn
