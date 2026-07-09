# GDG DJU 동아리 관리 시스템

GDG on Campus 대전대학교 운영진을 위한 동아리 관리 웹앱입니다. 회원 관리, 지원서 접수, 이벤트 등록, 신청/대기열, 출석 체크와 대시보드를 제공합니다.

- **스택**: Next.js (App Router) + Supabase (Auth/DB) + Tailwind CSS
- **배포**: Vercel(무료 플랜) + Supabase(무료 프로젝트)로 비용 없이 운영 가능합니다.

## 1. 로컬 실행

```bash
pnpm install
cp .env.example .env.local   # 아래 "Supabase 세팅"에서 발급받은 값을 채워주세요
pnpm dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

## 2. Supabase 세팅

1. [supabase.com](https://supabase.com)에서 무료 프로젝트를 생성합니다. 리전은 **Seoul**을 선택하세요.
2. 프로젝트의 DB 스키마를 적용합니다. 둘 중 편한 방법을 사용하세요.
   - **Supabase CLI**: 저장소에 `config.toml`이 없으므로 먼저 `supabase init`을 실행한 뒤, `supabase link --project-ref <project-ref>` 실행 후 `supabase db push`
   - **SQL Editor**: Supabase 대시보드 > SQL Editor에서 `supabase/migrations/` 폴더의 파일을 `0001_init.sql` → `0002_event_counts.sql` → `0003_waitlist_position.sql` 순서대로 실행합니다.
3. Supabase 대시보드 > Authentication > Providers에서 **Google**을 활성화합니다. (Client ID/Secret은 3번 단계에서 발급)
4. Project Settings > API에서 Project URL, anon public key를 확인해 `.env.local`에 채워 넣습니다.

## 3. Google OAuth 설정

1. [Google Cloud Console](https://console.cloud.google.com)에서 프로젝트를 만들고 OAuth 클라이언트 ID(웹 애플리케이션)를 생성합니다.
2. 승인된 리디렉션 URI에 다음을 등록합니다.
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
3. 발급받은 Client ID / Client Secret을 Supabase 대시보드 > Authentication > Providers > Google에 등록하고 저장합니다.

## 4. Vercel 배포

1. GitHub 저장소를 [Vercel](https://vercel.com)에 Import합니다.
2. 프로젝트 환경 변수에 `.env.example`에 있는 3개 값을 등록합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (배포된 Vercel 도메인, 예: `https://gdg-dju.vercel.app`)
3. Deploy를 실행합니다.
4. Supabase 대시보드 > Authentication > URL Configuration에서 **Site URL**과 **Redirect URLs**에 Vercel 도메인을 추가합니다. (등록하지 않으면 배포 환경에서 로그인 후 리다이렉트가 실패합니다.)

## 5. 첫 admin 지정

1. 배포된 사이트에서 Google 로그인으로 회원가입(온보딩)을 완료합니다.
2. Supabase 대시보드 > SQL Editor에서 아래 쿼리를 실행해 본인 계정을 admin으로 승격합니다.
   ```sql
   update public.profiles set role = 'admin' where id = '<user-uuid>';
   ```
   `<user-uuid>`는 Authentication > Users 목록에서 확인할 수 있습니다.

## 6. 배포 후 검증 체크리스트

- [ ] Google 로그인 → 온보딩(프로필 입력) 완료
- [ ] 관리자 계정으로 이벤트 생성
- [ ] 정원 2명 이벤트에 3명이 신청 → 3번째 신청자가 대기열로 등록되는지 확인
- [ ] confirmed 상태 회원이 신청 취소 → 대기열 1번이 confirmed로 승격되는지 확인
- [ ] 관리자 페이지에서 출석 코드 발급 → 회원이 코드 입력 후 출석 처리되는지 확인
- [ ] 잘못된 출석 코드 입력 시 거부되는지 확인

## Phase 2

Phase 2에서 공지사항, 설문, 문의/건의, 포인트/뱃지, 예산/후원, 자료실(노션 연동), 출석 경고 크론(슬랙 알림), 감사 로그 기능이 추가되었습니다.

### DB 마이그레이션

Phase 2 기능을 쓰려면 `supabase/migrations/0004_phase2.sql`을 추가로 적용해야 합니다. Supabase CLI 또는 SQL Editor에서 `0001` → `0002` → `0003` 다음 순서로 `0004_phase2.sql`을 실행하세요.

### 슬랙 웹훅 만들기 (출석 경고 알림)

1. [api.slack.com/messaging/webhooks](https://api.slack.com/messaging/webhooks)에서 안내에 따라 워크스페이스에 인커밍 웹훅 앱을 추가합니다.
2. 알림을 받을 채널을 선택하고 발급된 웹훅 URL을 `SLACK_WEBHOOK_URL` 환경 변수에 등록합니다.

### 노션 연동 (자료실)

1. [notion.so/my-integrations](https://www.notion.so/my-integrations)에서 internal integration을 생성하고 API 키를 발급받습니다.
2. 자료실로 사용할 노션 DB 페이지(`https://app.notion.com/p/bab8396dca104b5fa94a90ffcb09ebb2`)에서 `⋯` 메뉴 > 연결에서 방금 만든 integration을 추가합니다.
3. `NOTION_API_KEY`에 발급받은 API 키를, `NOTION_DATABASE_ID`에 `bab8396dca104b5fa94a90ffcb09ebb2`를 등록합니다.

### Vercel Cron (출석 경고)

`vercel.json`에 크론 설정이 이미 포함되어 있어 Vercel에 배포하면 매주 월요일 자정에 `/api/cron/attendance-warning`이 자동으로 호출됩니다. Vercel 프로젝트 환경 변수에 `CRON_SECRET`(임의의 랜덤 문자열)과 `SUPABASE_SERVICE_ROLE_KEY`를 등록해야 정상 동작합니다.

## 7. 주의사항

- Supabase 무료 프로젝트는 **7일간 활동이 없으면 자동으로 일시정지**됩니다. Supabase 대시보드에서 프로젝트를 열어 복구할 수 있습니다.
- **마지막 admin 계정을 member로 강등하면 어드민 화면에 아무도 접근할 수 없게 됩니다.** 이 경우 Supabase SQL Editor에서 직접 `update public.profiles set role = 'admin' where id = '<user-uuid>'`로만 복구할 수 있습니다.
- `NEXT_PUBLIC_SITE_URL`을 설정하지 않으면 출석용 QR 코드가 올바른 주소를 가리키지 못해 스캔이 되지 않습니다. 반드시 배포된 실제 도메인으로 설정하세요.
