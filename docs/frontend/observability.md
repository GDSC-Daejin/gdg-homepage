# 프론트엔드 관측성 도입 계획

> 상태: Planned
> 결정일: 2026-09-09

운영 중 재현되지 않는 오류와 성능 병목을 확인하기 위한 향후 계획이다. 현재 프로젝트에는 Sentry SDK와 계측·배포 파이프라인이 없으므로 이 문서는 구현 지시가 아니다.

## 도입 조건

실제 사용자 트래픽과 배포 환경이 생긴 뒤 organization·project·environment, 담당자·알림 채널, 개인정보 금지 목록, 샘플링 예산, release 연결 방식, source map 업로드 위치를 결정한다.

## 단계

1. production 오류 모니터링: 브라우저·React·Next.js 서버 오류, 주요 요청 실패, release·environment·route 그룹화
2. 성능 모니터링: 초기 로드, Web Vitals, 느린 전환, API 지연
3. 백엔드 연동: 실제 API가 제공될 때 프론트 요청과 백엔드 trace 연결
4. Session Replay·Profiling: 재현하기 어려운 문제가 있고 개인정보 masking·보존 정책을 확정한 경우에만 검토

도입 시 SDK 공식 문서와 설치된 Next.js 버전을 다시 확인하고, Sentry 초기화 진입점은 하나만 선택한다. Sentry 장애가 제품 동작을 막지 않아야 한다.

## 보안 기준

- auth token과 source map 업로드 secret은 Client bundle과 저장소에 넣지 않는다.
- 인증 토큰, 비밀번호, 결제 정보, 요청 본문, 민감한 query string과 개인정보를 이벤트·tag·breadcrumb·context에 넣지 않는다.
- production과 development 이벤트를 분리한다.
- route·API 이름에서 동적 ID를 제거해 cardinality를 제한한다.
- Replay는 기본 도입 범위가 아니며 mask·block과 접근 권한·보존 기간을 먼저 검증한다.

관측성은 사용자 행동 테스트와 Lighthouse를 대체하지 않는다.
