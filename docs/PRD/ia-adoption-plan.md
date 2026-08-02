# IA 반영 수정기획안 — 리크루팅 중심 IA를 GDG DJU 플랫폼에 통합

> 외부 IA(정보 구조도)를 현 서비스에 적용하기 위한 기획 문서.
> 각 항목을 **흡수 / 절충 / 폐기** 3단계로 판정하고, 근거와 구체안을 기록한다.
> 이 문서는 기획안이며, 코드 변경은 포함하지 않는다.

---

## 0. 판단 기준

| 판정 | 의미 |
|---|---|
| **흡수** | IA 요소를 그대로(또는 거의 그대로) 도입. 기존 서비스와 충돌 없음 |
| **절충** | 취지는 살리되 우리 서비스의 기존 체계(라우트·역할·데이터 모델·Slack 중심 소통)에 맞게 변형 |
| **폐기** | 이미 대체 수단이 있거나, 우리 방향성과 다르거나, 비용 대비 효용이 낮음 |

### 전제가 되는 현 서비스 구조

- **라우트 3계층**: 퍼블릭(`/about` `/team` `/events` `/projects` `/apply` `/login`) · 멤버(`/` 대시보드, `/attend` `/notices` `/surveys` `/inquiries` `/materials` `/profile`) · 어드민(`/admin/*` 12개 메뉴)
- **역할**: `organizer` `team_member`(둘이 ADMIN_ROLES) / `member` / `applicant`
- **포지션**: `frontend` `backend` `designer` 3개
- **지원서 상태**: `waiting → pending → accepted / rejected` (자유 전환 가능)
- **소통 채널**: Slack (공지 발행, 출석 경고 등 이미 연동). 이메일 인프라 없음
- **`/` 는 로그인 필수 멤버 대시보드** → 비로그인 방문자용 랜딩 홈이 없음 (IA와의 최대 격차)
- **`/apply` 는 상시 오픈** — 모집 on/off 개념 없음, 지원서에 지원 파트 없음
- 퍼블릭 페이지는 정적 코드로 관리 (CMS 없음)

### IA 원본과의 근본 차이

IA는 **모집(리크루팅) 시즌 운영에 특화된 사이트** 구조다. 우리 서비스는 모집을 포함한
**연중 멤버십 운영 플랫폼**(출석·포인트·설문·문의·예산·자료실)이다.
따라서 IA의 리크루팅 축은 대부분 흡수하되, IA에 없는 기존 운영 기능은 그대로 유지하고,
IA의 소통(Email)·콘텐츠(CMS) 축은 우리의 Slack·코드 관리 방식과 절충한다.

---

## 1. 판정 요약표

### 퍼블릭 영역

| IA 요소 | 판정 | 요지 |
|---|---|---|
| Home 허브 (프리뷰 + CTA) | **절충** | `/`를 비로그인 시 랜딩, 로그인 시 기존 대시보드로 분기 |
| About 서브섹션 (Introduction·What is GDGoC·Mission&Vision·Core Values·What We Do) | **흡수** | 기존 `/about` 콘텐츠 섹션 보강 |
| Team — Chapter Lead / Core Team / Contact & Links | **흡수** | 기존 `/team` 구조 보강 |
| Team — 파트 6개 (FE·BE·ML·Mobile·Design·Beginner) | **절충** | 우리 포지션 3개(frontend/backend/designer) 기준으로 축소 |
| Activities (와플·테디·프로젝트·세션&파티) | **절충** | 별도 페이지 신설 없이 기존 `/events` + `/projects`로 커버. 타 조직 고유 프로그램명(와플·테디)은 폐기 |
| Join (How to Join) | **절충** | 별도 `/join` 없이 `/apply`에 지원 절차 안내 + 모집 상태 표시 |
| 헤더 우측 어드민 링크 | **흡수** | admin 권한자에게만 노출 |

### 어드민 영역

| IA 요소 | 판정 | 요지 |
|---|---|---|
| Dashboard — Overview (모집 상태·지원자 수·진행 단계) | **흡수** | 기존 대시보드에 리크루팅 위젯 추가 (모집 중일 때만 노출) |
| Dashboard — Today (오늘 일정·할 일) | **절충** | 오늘 일정은 events에서, 할 일은 심사 대기 카운트로 (면접 미운영으로 "면접 예정" 없음) |
| Dashboard — Quick Actions | **흡수** | 링크 3개 수준의 저비용 요소 |
| Applications — 검색 | **흡수** | 이름/학번 검색 추가 (시즌·상태 필터는 이미 있음) |
| Applications — By Role (파트별) | **절충** | 지원서에 지원 파트 필드 추가, 단 우리 3파트 기준 |
| Applications — Pipeline (서류→인터뷰→합불) | **폐기** | 면접 미운영 확정 — `interview` 단계 도입 안 함. 서류→합불로 유지 |
| Applications — Applicant Detail | **흡수(기존 유지)** | 상세·상태 변경·감사 로그 이미 있음. 심사 메모만 보강 |
| Communication — Email (Templates/Send/Bulk) | **절충** | 합불 통보 이메일 자동 발송 도입 확정 (Phase 3). 범용 이메일 시스템은 폐기 |
| Communication — Email Log | **절충** | 합불 통보 발송 기록만. 기존 audit log 재사용 |
| Communication — Notification (내부 운영진 알림) | **폐기** | Slack 알림이 이미 담당 |
| Members — Core Team/Members 그룹핑 | **흡수** | 기존 회원 목록에 역할 필터 보강 |
| Members — Guest 역할 | **폐기** | 우리 역할 체계에 없고 수요 없음 |
| Members — Role & Permission (접근 권한 설정) | **폐기** | 2단계 admin 권한으로 충분. 세분화 RBAC는 과잉 |
| Members — Profile | **폐기(중복)** | 멤버 상세 + 본인 프로필 페이지 이미 존재 |
| Content (About/Team/Activities/Join 페이지 편집) | **폐기** | 정적 페이지는 코드로 관리. CMS 구축 비용 > 효용 |
| Schedule — Calendar | **폐기(보류)** | 기존 events 리스트로 충분. 월 뷰는 수요 확인 후 |
| Schedule — Interview Schedule | **폐기** | 면접 미운영 확정 — 면접 일정 개념 없음 |
| Schedule — Events | **폐기(중복)** | `/admin/events` 이미 존재 |
| Settings — 모집 상태 on/off | **흡수** | 이번 통합의 핵심. 신규 설정 도입 |
| Settings — 파트 활성화 | **절충** | 시즌별 모집 파트 선택으로 변형 |
| Settings — Account/Logout | **폐기(중복)** | 이미 존재 |

---

## 2. 상세 기획 — 흡수·절충 항목

### 2.1 모집 시즌 설정 (IA: Settings → 모집 상태 on/off, 파트 활성화) — 핵심

현재 `/apply`는 상시 오픈이며 시즌은 `CURRENT_SEASON` 상수 하드코딩이다.
IA의 "모집 상태 on/off"를 흡수하면 리크루팅 축 전체(대시보드 위젯·apply 마감·랜딩 CTA)가 이 설정 하나에 연동된다.

**안:**
- 신규 테이블 `recruiting_settings` (단일 행): `season`(예: "2026-2"), `is_open`(boolean), `open_positions`(text[] — 모집 파트, 기본 3파트 전체)
- 어드민 신규 메뉴 `/admin/settings` (관리 그룹, "설정") — 시즌명 변경, 모집 열기/닫기 토글, 모집 파트 체크박스
- 연동 지점:
  - `/apply`: 닫힘이면 폼 대신 "지금은 모집 기간이 아니에요" 안내 (서버 액션에서도 차단 — 신뢰 경계 검증)
  - 퍼블릭 랜딩·헤더 CTA: 모집 중일 때만 "지원하기" 강조
  - 어드민 대시보드: 모집 중일 때 리크루팅 위젯 노출
- 권한: ADMIN_ROLES 공통 (organizer 한정 세분화는 하지 않음 — 폐기 사유 §3.3과 동일 논리)
- 변경 시 audit log 기록 (기존 패턴 재사용)

### 2.2 지원서에 지원 파트 추가 (IA: Applications → By Role)

IA의 파트별 지원자 관리를 흡수하되, 파트 축은 IA의 6개가 아닌 **우리 포지션 3개**를 쓴다.
(ML·Mobile·Beginner 파트는 현 조직에 없음 — 파트 신설은 이 문서 범위 밖의 조직 결정)

**안:**
- `applications`에 `position`(frontend/backend/designer) 컬럼 추가. 기존 데이터는 null 허용("미지정" 표기)
- `/apply` 폼에 지원 파트 선택 추가 — 선택지는 `recruiting_settings.open_positions`만 노출
- `/admin/applications` 리스트에 파트 필터 추가 (기존 시즌·상태 필터와 같은 패턴), 상태 탭 카운트처럼 파트별 카운트 표기
- 기존 `Position` 타입·`POSITION_LABELS` 재사용. 합격 → 프로필 전환 시 position 자동 승계

### 2.3 지원서 검색·심사 메모 (IA: Applications → 리스트/검색/필터, 메모/평가)

시즌·상태 필터는 이미 있으므로 격차만 메운다.

**안:**
- 리스트에 이름/학번 텍스트 검색 (searchParams 기반, 기존 필터와 동일 패턴)
- 상세 페이지에 심사 메모: `applications.review_note`(text) 단일 필드. 작성자·시각은 audit log가 이미 남기므로 별도 메모 테이블·점수화·다중 평가는 도입하지 않음 (IA의 "평가"는 과잉으로 판단 — 필요해지면 그때 확장)
- 히스토리 로그: 기존 audit log로 이미 충족 → 추가 작업 없음

### 2.4 어드민 대시보드 리크루팅 위젯 (IA: Dashboard → Overview·Today·Quick Actions)

기존 대시보드(회원 수·이벤트·만족도·포인트 랭킹)는 유지하고, **모집 중일 때만** 리크루팅 섹션을 상단에 추가한다.

**안:**
- Overview: 현재 시즌·모집 상태 배지, 지원자 수(전체/파트별), 단계별 카운트(심사 대기 waiting / 검토 중 pending / 합격 / 불합격) — 각 숫자는 해당 필터가 걸린 지원서 리스트로 링크
- Today: 오늘 시작하는 이벤트(기존 events 조회) + "심사 대기 N건" 할 일 카드. IA의 "면접 예정"은 면접 미운영으로 제외
- Quick Actions: 지원자 관리 / 공지 작성 / 이벤트 생성 바로가기 3개 (IA의 "이메일 발송"은 우리 체계에선 "공지 작성"으로 치환)

### 2.5 퍼블릭 랜딩 홈 (IA: Home 허브)

IA와의 최대 격차. 현재 비로그인 방문자는 `/login`으로 튕겨 서비스 소개를 볼 수 없다.

**안 (절충):**
- `/` 단일 라우트에서 분기: **비로그인 → 퍼블릭 랜딩 / 로그인 → 기존 멤버 대시보드** (새 라우트를 파지 않아 기존 링크·리다이렉트 전부 무수정)
- 랜딩 구성 (IA Home 축 그대로): About 프리뷰 → What We Do 프리뷰(활동 유형 3종: 정기세션·스터디·모각코) → Team 프리뷰 → CTA
- CTA는 모집 상태 연동: 모집 중 "지금 지원하기 → /apply", 마감 시 "활동 둘러보기 → /events"
- 퍼블릭 공통 헤더: About / Team / Activities(→ /events) / Projects / 지원하기 + 로그인. admin 권한자에겐 "어드민" 링크 (IA 헤더 요구 흡수)

### 2.6 About·Team·Join 콘텐츠 보강 (IA: About·Team·Join)

- `/about`: IA 섹션 구조 흡수 — 소개 / What is GDG on Campus / Mission & Vision / Core Values / What We Do. 정적 콘텐츠로 작성 (CMS 없음, §3.4)
- `/team`: Chapter Lead → Core Team → 파트별(3파트) 멤버 → Contact & Links 순 재구성
- Join: 별도 페이지 대신 `/apply` 상단에 "지원 절차" 안내(서류 → 심사 → 결과 안내)와 모집 상태 표시. 랜딩 CTA가 IA의 Join 진입 역할을 대신함

### 2.7 회원 목록 역할 필터 (IA: Members → Core Team/Members)

- `/admin/members`에 역할 필터(운영진/멤버/지원자) 추가 — 기존 필터 패턴 재사용. 이것으로 IA의 Core Team/Members 그룹핑 요구 충족

### 2.8 [Phase 3] 합불 통보 이메일 (IA: Email)

> **결정 확정(2026-07-12):** ① 면접 전형 미운영 → `interview` 상태·면접 일시는 도입하지 않음. ② 파트 3개 유지. ③ 합불 통보는 이메일 자동 발송.
> 따라서 Phase 3 = **합불 통보 이메일**만. IA의 Pipeline·Interview Schedule 요소는 폐기.

- 파이프라인은 `waiting → pending → accepted/rejected` 그대로 유지 (면접 단계 없음)
- 합불 통보 이메일: 지원자는 Slack에 없어 이메일이 유일한 통보 수단. **범위 최소화** — 합격/불합격 템플릿 2종 고정, 상태 확정 시 개별/일괄 발송, 발송 기록은 audit log. Resend 등 단일 발송 API 사용. IA의 범용 Email Templates·Bulk Send 시스템은 이 최소 기능으로 대체
- 선행 준비: 발송 서비스(Resend 등) 계정 + 발신 도메인 인증, `applications`에 지원자 이메일 수집 필드 확보(`/apply` 폼)

---

## 3. 폐기 항목과 사유

### 3.1 Communication → Notification (내부 운영진 알림)
Slack 연동이 이미 공지 발행·출석 경고를 처리한다. 인앱 알림 시스템을 추가로 짓는 것은 중복 투자.

### 3.2 Members → Guest 역할
4단계 역할 체계(organizer/team_member/member/applicant)에 없는 개념이고, 게스트가 로그인해서 볼 컨텐츠가 없다. 외부 공개 정보는 퍼블릭 페이지가 담당.

### 3.3 Members → Role & Permission (접근 권한 설정 화면)
현재 "ADMIN_ROLES면 어드민 전체 접근"의 단순한 모델이 운영 규모(단일 챕터 동아리)에 적합하다. 메뉴별 권한 매트릭스는 관리 비용만 늘린다. 역할 변경 자체는 멤버 상세에서 이미 가능.

### 3.4 Content (퍼블릭 페이지 CMS)
About/Team 등은 시즌에 1~2회 바뀌는 정적 콘텐츠이고, 운영진이 개발 동아리라 코드 수정이 가능하다. 에디터·미리보기·버전 관리를 갖춘 CMS는 비용 대비 효용이 낮음. 자주 바뀌는 값(시즌명·모집 상태·모집 파트)만 §2.1 설정으로 분리하는 것이 절충점.

### 3.5 Schedule → Calendar (월 캘린더 뷰)
어드민 이벤트 리스트가 이미 시간순 관리를 제공. 월 뷰는 있으면 좋은 수준이라 수요가 확인되면 후순위로.

### 3.6 IA 고유 프로그램·파트 (와플·테디·ML·Mobile·Beginner)
타 조직의 고유 프로그램/파트 명칭. 우리 활동 체계(정기세션·스터디·모각코·프로젝트)와 포지션 체계로 대응. 파트 확장은 조직 차원의 결정이 선행돼야 하므로 이 기획에서 다루지 않음.

---

## 4. 권한 매트릭스 (변경 후)

| 화면/기능 | 비로그인 | member | admin (organizer·team_member) |
|---|:---:|:---:|:---:|
| 랜딩 홈 `/` | ✅ 랜딩 | ✅ 대시보드 | ✅ 대시보드 (+헤더 어드민 링크) |
| About / Team / Events / Projects | ✅ | ✅ | ✅ |
| `/apply` (모집 중) | ✅ 로그인 불필요 유지 | ✅ | ✅ |
| `/apply` (마감) | 안내만 (제출 차단 — 서버에서도 검증) | 동일 | 동일 |
| 멤버 기능 (출석·설문·문의 등) | ❌ → /login | ✅ | ✅ |
| `/admin/*` 전체 (기존) | ❌ | ❌ → / | ✅ |
| `/admin/settings` 모집 설정 (신규) | ❌ | ❌ | ✅ (변경 시 audit log) |
| 지원서 열람·상태 변경·메모 | ❌ | ❌ | ✅ |
| 합불 이메일 발송 (Phase 3) | ❌ | ❌ | ✅ (발송 기록 필수) |

원칙: 새 기능은 전부 기존 `requireAdmin()` / RLS 패턴을 그대로 따르고, 새 권한 등급을 만들지 않는다.

---

## 5. 단계별 실행 계획

| Phase | 범위 | 항목 |
|---|---|---|
| **1. 모집 코어** | 데이터·어드민 | 모집 설정(§2.1) → 지원 파트(§2.2) → 검색·메모(§2.3) → 대시보드 위젯(§2.4) |
| **2. 퍼블릭 얼굴** | 랜딩·콘텐츠 | 랜딩 홈 분기(§2.5) → About/Team/Join 보강(§2.6) → 헤더 어드민 링크 → 회원 역할 필터(§2.7) |
| **3. 합불 통보** | 이메일 | 합불 통보 이메일 자동 발송(§2.8) — 면접 단계 없이 서류→합불 확정 후 발송 |

Phase 1이 선행돼야 하는 이유: 랜딩 CTA·apply 마감 안내·대시보드 위젯이 모두 모집 설정(§2.1)에 의존한다.

### 열린 결정 — 확정 완료 (2026-07-12)

1. **면접 전형 운영 여부** → **운영 안 함.** `interview` 상태·면접 일시·면접 일정은 도입하지 않음. 필요해지면 상태 자유 전환이라 나중에 `interview` 1개만 추가 가능.
2. **모집 파트 3개 초과 확장** → **3개 유지.** §2.2 그대로 진행, `Position` 타입 재사용. 확장은 조직 차원 결정이 선행돼야 하므로 이 기획 범위 밖.
3. **합불 통보 방식** → **이메일 자동.** Phase 3에서 Resend 등 발송 서비스 도입. 선행 준비: 발송 계정 + 발신 도메인 인증, `/apply`에서 지원자 이메일 수집.
