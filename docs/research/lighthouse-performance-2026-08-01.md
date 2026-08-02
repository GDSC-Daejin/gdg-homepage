# Lighthouse 성능 기록 — 2026-08-01

## 범위

- 대상: 로그아웃 상태의 루트 랜딩(`/`)
- 환경: 로컬 프로덕션 빌드(`pnpm build`, `next start`), Lighthouse 13.4.1, Chrome Headless Shell 151
- 조건: 모바일 폼 팩터, `--throttling-method=simulate`, 각 3회 실행 후 중앙값

이 결과는 로컬 합성 측정이다. 실제 사용자 지표와 Vercel Speed Insights 수치를 대체하지 않는다.

## 적용한 변경

- 랜딩 히어로의 초기 페이드인을 제거해 LCP 텍스트를 즉시 표시.
- 전역 GA4·Clarity·Vercel 분석 컴포넌트를 별도 클라이언트 청크로 분리.
- 화면 밖 랜딩 섹션에 `content-visibility: auto` 적용.
- 랜딩에만 시스템 글꼴을 적용해 Pretendard 서브셋 폰트 요청을 초기 경로에서 제외. 멤버 화면의 Pretendard는 유지.

## 결과

아래의 변경 전 값은 히어로·분석·화면 밖 렌더링 개선 후, 랜딩 시스템 글꼴 적용 전의 기준선이다.

| 항목 | 변경 전 중앙값 | 변경 후 중앙값 |
| --- | ---: | ---: |
| Lighthouse 성능 점수 | 90 | 98 |
| FCP | 2.26초 | 0.91초 |
| LCP | 3.24초 | 2.48초 |
| TBT | 64ms | 41ms |
| CLS | 0 | 0 |
| 웹폰트 요청 | 12개 | 0개 |

변경 전 대표 실행의 총 네트워크 전송량은 725KB, 변경 후는 약 400KB였다.

## 검증

- `pnpm test tests/landing-performance.test.ts` 통과 (4개)
- `pnpm build` 통과

## 재측정

```bash
pnpm build
pnpm exec next start -p 3002

CHROME_PATH=.cache/lighthouse/chrome-headless-shell/mac_arm-151.0.7922.71/chrome-headless-shell-mac-arm64/chrome-headless-shell \
pnpm exec lighthouse http://localhost:3002 \
  --only-categories=performance \
  --form-factor=mobile \
  --throttling-method=simulate \
  --output=json \
  --output-path=.cache/lighthouse/report.json
```

측정이 끝나면 `next start` 프로세스를 종료한다.
