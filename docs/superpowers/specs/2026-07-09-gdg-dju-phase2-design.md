# GDG DJU 관리 시스템 — 2차(Phase 2) 설계

날짜: 2026-07-09 / 상태: 승인됨 / 전제: 1차 MVP 완료(feat/mvp), 실 Supabase + Google 로그인 연결됨

## 범위 (1차에서 미구현된 전 항목, 예산 포함)

1. **공지사항** — 어드민 작성/발행, 회원 열람. 발행 시 **슬랙 웹훅** 알림 (사용자 결정: 앱 푸시 대체)
2. **출석 미달 자동 알림** — Vercel Cron(주 1회) → 출석률 50% 미만 활동 회원 목록을 슬랙 웹훅으로. 어드민 수동 발송 버튼 병행
3. **자료실** — **노션 연동** (사용자 결정): 운영진은 노션 DB에서 자료 관리, 앱 `/materials`는 읽기 전용 표시 (제목/유형/이벤트/링크/날짜)
4. **설문조사** — 어드민 생성(5점 척도+주관식, 이벤트 연결 선택), 회원 응답(설문당 1회), 결과(평균/분포/주관식 목록)
5. **문의/건의** — 회원 제출, 어드민 답변(상태: 접수/답변완료)
6. **포인트/뱃지** — 출석 시 자동 +10(DB 트리거), 발표/프로젝트는 어드민 수동 부여. 뱃지 정의/수여. 회원 프로필에 표시
7. **예산/후원** — 수입/지출 내역, 스폰서 관리 (admin only)
8. **감사 로그** — admin RPC 전체(역할/상태 변경, 심사, 코드 발급, 포인트/뱃지 부여, 문의 답변)에 로깅 + 어드민 열람
9. **통계 확장** — 월별 신규 가입 추이, 세션별 만족도(설문 평균), 활동 랭킹 Top 10(포인트)

## 외부 연동 계약

- 슬랙: env `SLACK_WEBHOOK_URL` (Incoming Webhook). 미설정 시 발송 스킵 + 어드민에 안내.
- 노션: env `NOTION_API_KEY`(internal integration) + `NOTION_DATABASE_ID`. 미설정 시 /materials에 설정 안내 표시. 노션 DB는 Claude가 MCP로 생성 후 사용자에게 integration 연결 안내.
- Cron: env `CRON_SECRET`(Bearer 검증) + `SUPABASE_SERVICE_ROLE_KEY`(크론은 사용자 세션이 없어 RLS 우회 집계 필요, 서버 전용). `vercel.json` crons 1개(Hobby 무료 한도 내).

## 신규 테이블 (마이그레이션 0004, 기존 데이터 무변경)

notices / surveys / survey_responses / inquiries / point_logs / badges / user_badges / budget_entries / sponsors / audit_logs — 상세 스키마·RLS·트리거·RPC는 구현 계획의 0004 SQL이 계약.

## 원칙 (1차와 동일)

완전 무료, 쓰기는 Server Action 첫 줄 가드 + RLS 2차 방어, 원자성·권한 로직은 security definer RPC, 신규 함수는 EXECUTE revoke/grant 필수(1차 최종 리뷰 교훈), 사용자 문구 한국어, 실 DB 검증.
