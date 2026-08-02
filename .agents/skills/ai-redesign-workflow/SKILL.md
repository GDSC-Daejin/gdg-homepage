---
name: ai-redesign-workflow
description: Reference-led UI redesign workflow that preserves existing functionality and data contracts. Use when redesigning, restyling, or improving an existing screen or shared UI in this project.
---

# AI 리디자인 워크플로

작업 전에 [프로젝트 워크플로](../../../docs/ai-redesign-workflow-general.md)를 끝까지 읽고 따른다.

## 진행

1. 현재 화면과 유지·개선할 사항, 적용 범위를 정리한다.
2. 레퍼런스 이미지로 방향을 합의한다. 합의 전에는 구현하지 않는다.
3. 선택한 시안에서 위계·표면·강조·밀도·반응형 규칙만 추출한다.
4. 기존 디자인 시스템과 컴포넌트를 우선 사용해, 한 번에 한 덩어리씩 최소 변경으로 적용한다.
5. 기능, API, 정보 구조, 접근성 속성, 테스트 셀렉터는 바꾸지 않는다. 기능 변경이 필요하면 별도 범위로 분리한다.
6. 관련 타입 검사와 가장 작은 테스트를 실행하고, 링크·키보드 조작·빈/오류 상태·셀렉터를 확인한다.

큰 리디자인은 기존 화면을 바로 바꾸지 말고 별도 미리보기 경로 또는 브랜치에서 검토한다.
