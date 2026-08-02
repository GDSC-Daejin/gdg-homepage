# GDG 대전 커뮤니티

GDG 대전 커뮤니티의 지원·회원·이벤트 운영을 담당하는 웹 서비스. 이 문서는 구현이 아니라 **용어**만 정의한다.

## 사람 · 역할 (Role)

한 사람(`profiles`)은 아래 4개 role 중 하나를 가진다. role은 권한 단계이자 커뮤니티 내 신분이다.

**Applicant** (지원자):
아직 회원이 아닌, 지원서를 낸 사람. 신규 가입 기본 role. 지원이 accepted되면 member로 승격된다.
_Avoid_: 신청자, 지원인

**Member** (회원):
정식 커뮤니티 회원. 이벤트 신청 등 회원 기능을 쓸 수 있다.
_주의_: "멤버"를 로그인 유저 전체나 team_member의 줄임말로 쓰지 말 것. Member는 role='member' 한 단계만 가리킨다.

**Team Member** (팀 멤버):
커뮤니티를 운영하는 스태프. 다수 존재. 운영 화면(관리 기능)에 접근한다.
_Avoid_: 스태프, 운영진(구어로만)

**Organizer** (오거나이저):
전체에서 단 1명. 최상위 운영자. team_member 권한을 모두 포함한다.
_Avoid_: 어드민, 관리자(대표 지칭 시)

**Staff** (운영자):
organizer + team_member를 합쳐 부르는 말. role이 아니라 두 role의 묶음이다. 운영 화면(`/admin`)에 접근할 수 있는 사람 = Staff.

**Admin / 어드민**:
role은 **아니다**. **운영 화면(`/admin`)과 그 접근 판정**(`is_admin()` = organizer ∪ team_member)을 가리킨다.
- ✅ **장소·surface 라벨로는 OK**: "어드민 화면", 사이드바 진입점 "어드민" — 사용자에게 직관적.
- ❌ **신분·role 단어로는 금지**: "이 사람은 어드민이야"(X) → organizer / team_member / Staff(운영자)로.

→ [ADR-0001](docs/adr/0001-admin-means-staff-access-not-a-role.md)

## 지원 (Application)

**Application** (지원서):
커뮤니티 가입을 위해 제출하는 문서. 로그인 지원(applicant_id 있음)과 익명 지원(null) 둘 다 가능.

**심사 상태** (Application Status) — 지원서의 심사 단계 (waiting → pending → accepted/rejected):
- **Waiting** = **심사 대기**: 신규 지원 기본값. 아직 심사 착수 전.
- **Pending** = **심사 중**: 심사가 진행 중. (⚠️ inquiries의 `pending`("접수")과 raw 값만 같고 뜻이 다름 — [상태](#상태-status--공통-규칙) 참고)
- **Accepted** = **합격**: 승인. 로그인 지원자는 이때 member로 승격.
- **Rejected** = **불합격**: 거절.

## 이벤트 (Event)

**Event** (이벤트):
커뮤니티가 여는 행사. type은 session / study / devfest (+ mogakco).
_Avoid_: 행사(문서 제목 외), 모임

**Event Registration** (이벤트 신청):
회원이 특정 이벤트에 참가 신청한 기록. Attendance(실제 출석)와 구분된다.

**정원 상태** (Registration Status) — 신청의 정원 처리 상태:
- **Confirmed** = **확정**: 정원 내 확정.
- **Waitlisted** = **대기**: 정원 초과로 대기열. 확정자가 취소하면 승급. UI에서 항상 "확정"과 나란히 나오므로 "대기"로 충분.

⚠️ **"대기" 두 개 구분** (확정): 지원서의 `waiting`(**심사 대기**)과 이벤트 신청의 `waitlisted`(**정원 대기**)는 다른 개념이다. 코드상 타입도 분리됨(`ApplicationStatus` vs `RegistrationStatus`). 말할 때 그냥 "대기"라 하지 말고 "심사 대기" / "정원 대기"로 구분.

**Attendance** (출석):
이벤트에 실제로 출석한 사실. event_code로 체크인. 신청(registration)과 별개.

## 상태 (Status) — 공통 규칙

이 프로젝트엔 `status` 컬럼이 **4개 엔티티**에 있고 각각 뜻이 다르다. 코드상 타입은 다 분리돼 있지만(type-safe), **말·문서에서는 그냥 "상태"라 하지 말고 아래 이름으로 부른다.**

| 부르는 이름 | 엔티티 | 값 |
|---|---|---|
| **회원 상태** | profiles | active(활동중) / dormant(휴면) / withdrawn(탈퇴) |
| **심사 상태** | applications | waiting / pending / accepted / rejected |
| **정원 상태** | event_registrations | confirmed / waitlisted |
| **문의 상태** | inquiries | pending(**접수**) / answered(답변완료) |

⚠️ **raw 값 중복 주의** — 개명하지 않되(테이블별 네임스페이스라 안전) 말할 때 헷갈리지 말 것:
- `pending`: 심사 상태에선 "심사 중", 문의 상태에선 "접수". → 항상 어느 상태인지 붙여 말한다.
- `confirmed`: 정원 상태의 "확정". 출석 집계 수를 세는 변수명으로도 쓰이니 문맥 구분.

## 회원 활동

**Position** (포지션):
회원이 스스로 고르는 활동 분야: frontend / backend / designer. Role과 무관.

## 운영 개념

**Meeting Poll** (회의 시간 조율):
후보 날짜·시간 격자를 열고 참여자가 각자 가능한 칸을 칠해, 겹치는 구간을 찾아 회의 시간을 확정하는 것. 화면은 `/schedule`("언제되지")이고 확정 시각은 어드민 이벤트 달력에 표시 전용으로 뜬다(Event를 만들지는 않는다). 후보 날짜는 연속 범위가 아니어도 되고(`dates date[]`), 칸 단위는 30분/1시간이다.
⚠️ **Meeting**(모지숲 **회의록**, Notion에서 동기화되는 문서)과 다른 개념이다. 조율은 회의 *전*, 회의록은 회의 *후*. 말할 때 "조율" / "회의록"으로 구분한다.
_Avoid_: when2meet(외부 서비스명), 회의 폴
→ 원본 기획·디자인 SOT: Claude Design "Schedule Coordination" (Wanted Design System)

**Participant** (참여자):
한 조율에 초대된 사람. **한 줄이 곧 그 사람의 응답이다**(`slots`·`responded_at`). 우리 회원이면 `user_id`가 있고, 이름·이메일만으로 초대된 사람은 null이다.
_Avoid_: 응답자(=응답을 마친 참여자만 가리킬 때만 쓴다), 초대자(=만든 사람과 헷갈린다)

**초대 링크** (Invite Link):
`/j/<invite_token>`. 로그인 없이 열려 자기 이름을 골라 칠하는 화면. 토큰을 아는 사람은 명단의 아무 이름으로나 응답할 수 있다 — 링크 자체가 권한이다.

**추천 구간** (Recommendation):
응답이 모인 뒤 가장 많이 겹치는 연속 구간 상위 3개. 최소 90분을 채우는 칸 수로 길이를 고정하고, "구간의 모든 칸이 가능한 사람" 수로 줄을 세운다.

**Notice** (공지), **Survey** (설문), **Inquiry** (문의), **Point Log** (포인트 내역), **Badge** (배지), **Budget Entry** (예산 항목), **Audit Log** (감사 로그).
— 각 용어의 경계가 논의에서 등장하면 이 자리에서 정의를 채운다.

_참고_: Sponsor(스폰서)는 제거됨 (마이그레이션 0015). 용어에서 제외.

## 아키텍처

**Community Store** (커뮤니티 저장소):
앱이 커뮤니티 기록(Member·Application·Event·Registration·Survey·Inquiry·Point Log·Budget Entry·Notice·Audit Log)을 읽고 쓰기 위해 건너는 seam. 집합별 store(MemberStore·EventStore·…)로 나뉘고, 각 store는 reads(raw 도메인 컬렉션)와 ops(원자적 쓰기 연산)를 가진다. Supabase adapter(실 DB, RLS·RPC 원자성)와 Demo adapter(둘러보기용 in-memory) 중 요청당 한 번 선택된다.
_Avoid_: repository/DAO(구현 레이어 명칭), "demo 분기"(더 이상 호출부에 없음).
→ [설계](docs/design/community-store-design.md)

**둘러보기** (Demo Mode):
`demo_mode` 쿠키로 켜지는 **영구 제품 기능**(임시 아님). 켜지면 Community Store가 Demo adapter를 선택해 모든 read는 예시 데이터, 모든 write는 **믿을 만한 성공 형태의 no-op**(에러 아님)을 반환한다. Staff가 `/admin`에서 토글.
