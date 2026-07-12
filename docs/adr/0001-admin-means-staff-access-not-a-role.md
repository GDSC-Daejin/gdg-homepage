---
status: accepted
---

# 코드의 "admin"은 role이 아니라 운영 접근 판정을 뜻한다

role 개편(마이그레이션 0009)에서 과거 `admin` role은 `organizer`(1명) + `team_member`(다수)로 분리되어 role enum에서 사라졌다. 그러나 라우트 `/admin/*`, DB 함수 `is_admin()`(약 30개 RLS 정책이 참조), `requireAdmin()`, `ADMIN_ROLES`, 사이드바 "어드민" 라벨에는 이름이 그대로 남아 있다. 이들 모두 이미 **"organizer ∪ team_member = 운영 화면 접근 권한"** 이라는 하나의 의미로 일관되게 동작한다.

**결정**: "admin"을 그 의미(운영 surface + 접근 판정)에 고정하고 개명하지 않는다. `admin`은 **role이 아니다** — role은 organizer / team_member / member / applicant 4개뿐이다. 사람에게 이 두 운영 role을 합쳐 부를 때는 "운영자(Staff)"라 하고, "admin/관리자"를 role 이름처럼 쓰지 않는다.

## Considered Options

- **개명 (`/admin`→`/staff`, `is_admin`→`is_staff` 등)**: 네이밍은 깔끔해지나 라우트·30개 RLS 정책·RPC·북마크를 전부 흔든다. 되돌리기 비싼 순수 리네이밍이라 기각.
- **`admin` role 재도입**: organizer/team_member 분리(0009)의 의도를 되돌리게 되어 기각.

## Consequences

- 미래 독자가 role enum에 `admin`이 없어 "버그인가?" 하고 놀랄 수 있으므로 이 문서와 [CONTEXT.md](../../CONTEXT.md)가 그 이유를 설명한다.
- 새 코드에서 `is_admin()` 계열 네이밍은 유지한다.
- 사용자 대면 문구에서 "어드민"은 **장소·진입점 라벨**로는 쓴다("어드민 화면") — 직관적이고 이 결정과 일관됨. 다만 **사람의 신분**을 가리킬 때는 organizer / team_member / 운영자를 쓴다.
