# SEO & AEO 구현 계획서 (Tier 1 + Tier 2)

> **대상 실행자:** Codex (이 대화 컨텍스트 없이 단독 실행)
> **범위:** 공개 페이지의 검색엔진(SEO) · 답변엔진(AEO) 최적화 기반 구축
> **원칙:** 순수 추가 위주. 기존 기능·데이터 계약·인증 로직 변경 금지.

---

## 0. 사전 조건 (반드시 먼저 확인)

### 0.1 커스텀 Next 주의
이 저장소의 Next는 **16.2.10이며 breaking change가 있는 커스텀 빌드**다 (`AGENTS.md` 참고).
metadata / robots / sitemap / manifest 코드를 작성하기 **전에** 반드시 아래 설치본 문서를 읽는다:

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`

확인된 시그니처(이 버전 기준, 표준과 동일):
```ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { ... }
export default function sitemap(): MetadataRoute.Sitemap { ... }
```

### 0.2 필요한 입력값 (2026-07-20 확정)
| 값 | 용도 | 결정 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | metadataBase·robots·sitemap의 절대 URL | **확정 — 조치 불필요.** 사용자가 `.env.local`에서 실제 배포 도메인으로 이미 수정함. 코드는 `process.env.NEXT_PUBLIC_SITE_URL`을 그대로 읽고 미설정 시 `http://localhost:3000` 폴백(T1-1). 도메인 문자열을 코드에 하드코딩하지 말 것 |
| GDG 공식/SNS 링크 | JSON-LD `sameAs` | **확정 — 지금은 전부 생략.** 현재 공식 채널 URL 없음. `sameAs`는 **빈 배열 `[]`로 남겨** 추후 URL만 채우면 되도록 확장 포인트 유지(배열 삭제하지 말 것) |
| 동아리 대표 이메일/연락처 | `Organization.email` (선택) | **확정 — 생략.** `email` 필드 자체를 넣지 않는다(추후 추가) |

> 확정: 위 세 값은 사용자와 합의 완료. `sameAs`/`email`을 **지어내지 말 것.** 나중에 채널이 생기면 `sameAs` 배열에 URL을 추가하고 필요 시 `email`을 넣는다.

### 0.3 손대지 말 것
- `(member)/**`, `admin/**`, `api/**` 의 **로직**. (메타데이터 noindex 추가는 예외 — 아래 T1-4)
- 홈 라우트(`src/app/page.tsx`)의 `force-dynamic` 및 인증 게이팅. (이번 범위 밖)
- 기존 `opengraph-image.tsx`, `icon.svg`.

---

## 공개 라우트 지도 (색인 대상)
| 경로 | 파일 | 성격 |
|---|---|---|
| `/` | `src/app/page.tsx` → 비로그인 시 `landing-preview/Landing.tsx` | 랜딩 (동아리 소개·모집) |
| `/about` | `src/app/about/page.tsx` | 소개·가치·활동 |
| `/team` | `src/app/team/page.tsx` | 운영진/팀 |
| `/events` | `src/app/events/page.tsx` | 정기 활동·이벤트 (정적 배열) |
| `/projects` | `src/app/projects/page.tsx` | 멤버 프로젝트 (정적 배열) |
| `/apply` | `src/app/apply/page.tsx` | 지원(모집) |

**비색인 대상:** `(member)/**`, `admin/**`, `/login`, `/onboarding`, `/auth/**`, `/api/**`

---

# Tier 1 — SEO 기반

## T1-1. 루트 메타데이터 확장 — `src/app/layout.tsx`

현재:
```ts
export const metadata: Metadata = {
  title: "GDG DJU 동아리 관리 시스템",
  description: "GDG DJU 동아리 운영을 위한 관리 시스템",
};
```

**문제:** `metadataBase` 없음 → OG 이미지·canonical 절대경로 미해결. OG/Twitter 카드 없음.

**변경:** 아래로 교체. `metadataBase`는 `NEXT_PUBLIC_SITE_URL` 기반, 미설정 시 안전 fallback.

```ts
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "GDG on Campus DJU · 대진대학교 개발자 동아리",
    template: "%s · GDG on Campus DJU",
  },
  description:
    "대진대학교 GDG on Campus(Google Developer Groups) — 배우고, 만들고, 배포하는 학생 개발자 커뮤니티. 정기세션·스터디·모각코·프로젝트로 함께 성장해요.",
  keywords: [
    "GDG", "GDG on Campus", "구글 개발자 그룹", "대진대학교",
    "개발 동아리", "코딩 동아리", "학생 개발자", "GDG DJU",
  ],
  openGraph: {
    type: "website",
    siteName: "GDG on Campus DJU",
    locale: "ko_KR",
    url: siteUrl,
    title: "GDG on Campus DJU · 대진대학교 개발자 동아리",
    description:
      "배우고, 만들고, 배포하는 대진대학교 학생 개발자 커뮤니티. 정기세션·스터디·모각코·프로젝트.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GDG on Campus DJU · 대진대학교 개발자 동아리",
    description:
      "배우고, 만들고, 배포하는 대진대학교 학생 개발자 커뮤니티.",
  },
  alternates: { canonical: "/" },
};
```

> `title.template` 도입 시 하위 페이지는 `title: "지원하기"` 만 주면 `지원하기 · GDG on Campus DJU`로 조합된다. **기존 `apply/page.tsx`의 `title: "지원하기 · GDG DJU"`는 T2에서 `title: "지원하기"`로 정리**(중복 접미사 방지).
> `openGraph.images`는 기존 `opengraph-image.tsx`가 자동 주입하므로 명시하지 않는다(중복 방지). 문서에서 자동 병합 동작 확인.

**수용 기준:** 빌드 후 `/` HTML `<head>`에 `og:title`, `og:image`(절대 URL), `twitter:card` 존재. `og:image`가 `https://<도메인>/opengraph-image...` 절대경로.

---

## T1-2. robots — `src/app/robots.ts` (신규)

**목적:** 공개 경로 허용, 비공개 차단, sitemap 연결. **AEO용 답변엔진 크롤러 명시 허용.**

```ts
import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/admin", "/api", "/login", "/onboarding", "/auth"];
  // (member) 그룹의 실제 URL 경로들 — 인증 게이트 뒤 콘텐츠
  const memberPaths = [
    "/notices", "/board", "/qna", "/surveys", "/materials",
    "/attend", "/inquiries", "/profile",
  ];
  const blocked = [...disallow, ...memberPaths];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: blocked },
      // 답변엔진(AEO) — 명시 허용으로 인용/색인 유도
      { userAgent: "GPTBot", allow: "/", disallow: blocked },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: blocked },
      { userAgent: "ChatGPT-User", allow: "/", disallow: blocked },
      { userAgent: "PerplexityBot", allow: "/", disallow: blocked },
      { userAgent: "Google-Extended", allow: "/", disallow: blocked },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
```

> `memberPaths`는 라우트 그룹 `(member)`의 실제 경로다(그룹명은 URL에 안 나타남). `src/app/(member)/` 하위 폴더명과 대조해 목록을 최종 확정할 것.

**수용 기준:** `/robots.txt` 응답에 각 크롤러 규칙 + `Sitemap:` 라인. `/admin`·`/notices` 등이 Disallow에 포함.

---

## T1-3. sitemap — `src/app/sitemap.ts` (신규)

```ts
import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/about", priority: 0.8, changeFrequency: "monthly" },
    { path: "/apply", priority: 0.9, changeFrequency: "weekly" },
    { path: "/events", priority: 0.7, changeFrequency: "weekly" },
    { path: "/projects", priority: 0.6, changeFrequency: "monthly" },
    { path: "/team", priority: 0.6, changeFrequency: "monthly" },
  ];
  const now = new Date();
  return routes.map((r) => ({
    url: `${siteUrl}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
```

**수용 기준:** `/sitemap.xml`에 6개 `<url>` 절대경로. 비공개 경로 미포함.

---

## T1-4. 비공개 영역 noindex

검색 색인에서 제외. 각 레이아웃에 `metadata` 추가(레이아웃은 metadata export 가능).

- `src/app/(member)/layout.tsx` — 추가:
  ```ts
  export const metadata = { robots: { index: false, follow: false } };
  ```
- `src/app/admin/layout.tsx` — 동일 추가.
- `src/app/login/page.tsx` — `export const metadata = { title: "로그인", robots: { index: false } };`
- `src/app/(member)/onboarding/page.tsx` — 이미 `(member)` 하위라 상속됨. 별도 조치 불필요(확인만).

> 기존 default export·`force-dynamic`은 그대로 두고 `metadata` export만 병렬 추가한다.

**수용 기준:** `/admin`, 멤버 페이지 HTML `<head>`에 `<meta name="robots" content="noindex...">`.

---

# Tier 2 — 페이지별 메타 + 구조화 데이터 (AEO 본체)

## T2-1. 페이지별 `metadata`

각 공개 페이지에 고유 title·description 추가. `title.template` 덕에 title은 짧게.
`page.tsx`에 `export const metadata` 추가(이미 `force-dynamic`인 파일도 metadata export 공존 가능).

| 파일 | title | description (검색결과 노출용, ~120자) |
|---|---|---|
| `about/page.tsx` | `"소개"` | `"GDG on Campus DJU는 함께 성장·실전 빌드·커뮤니티·오픈소스를 가치로 하는 대진대학교 개발자 동아리입니다. 정기세션·스터디·모각코·프로젝트로 활동해요."` |
| `team/page.tsx` | `"팀"` | 실제 팀 페이지 내용 확인 후 1문장 요약 작성 |
| `events/page.tsx` | `"활동·이벤트"` | `"정기세션·핸즈온·해커톤·모각코 등 GDG on Campus DJU의 학기 활동 일정입니다."` |
| `projects/page.tsx` | `"프로젝트"` | `"GDG on Campus DJU 멤버들이 만든 프로젝트 모음."` (주의: 현재 배열은 샘플 데이터로 보임 — 실제 여부 확인) |
| `apply/page.tsx` | `"지원하기"` | `"대진대학교 GDG on Campus 멤버 지원. 로그인 없이 바로 지원서를 작성할 수 있어요."` — **기존 `title: "지원하기 · GDG DJU"`를 `"지원하기"`로 교체**(T1-1 template 중복 제거) |

형식 예:
```ts
export const metadata = {
  title: "소개",
  description: "GDG on Campus DJU는 ...",
};
```

> `about/page.tsx` 등 일부는 현재 metadata export가 아예 없다 — 신규 추가. 이미 있는 `apply`는 값만 교체.

**수용 기준:** 각 페이지 HTML `<title>`이 `<페이지명> · GDG on Campus DJU`, `<meta name="description">`이 페이지 고유값.

---

## T2-2. JSON-LD 구조화 데이터 (AEO 핵심)

답변엔진이 그대로 인용·이해하도록 schema.org JSON-LD를 삽입한다.

### 공통 헬퍼 — `src/components/JsonLd.tsx` (신규)
```tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // ponytail: schema.org JSON-LD는 서버 렌더 문자열이면 충분
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```
> XSS 주의: `data`에는 정적/신뢰 값만 넣는다(사용자 입력 직접 주입 금지). 현재 대상은 전부 하드코딩 콘텐츠라 안전.

### (a) Organization + 홈 — `Landing.tsx` 또는 `page.tsx` 상단에 렌더
```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "GDG on Campus DJU",
  alternateName: "Google Developer Groups on Campus Daejin University",
  url: siteUrl,
  logo: `${siteUrl}/icon.svg`,
  description: "대진대학교 GDG on Campus — 배우고, 만들고, 배포하는 학생 개발자 커뮤니티",
  parentOrganization: {
    "@type": "CollegeOrUniversity",
    name: "대진대학교",
  },
  sameAs: [
    // 확정(2026-07-20): 현재 공식 채널 URL 없음 → 빈 배열 유지.
    // 추후 인스타/깃허브 등이 생기면 여기에 URL 문자열만 추가.
  ],
}} />
```
> `siteUrl`은 `process.env.NEXT_PUBLIC_SITE_URL` 사용. Landing이 클라이언트 컴포넌트면 서버에서 값 주입하거나 `page.tsx`(서버)에서 렌더.

### (b) Event — `events/page.tsx`, 배열 순회로 각 이벤트 발행
현재 배열 항목: `{ date: "2026.03.14", title, desc }`. `ItemList` + `Event`로:
```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: EVENTS.map((e, i) => ({
    "@type": "ListItem",
    position: i + 1,
    item: {
      "@type": "Event",
      name: e.title,
      description: e.desc,
      startDate: e.date.replaceAll(".", "-"), // "2026-03-14" (ISO 8601)
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      organizer: { "@type": "Organization", name: "GDG on Campus DJU" },
      // location: desc에 장소 있으면 Place로 분리(예: "세미나실 B", "대진대학교 창업지원센터")
    },
  })),
}} />
```
> `date` 문자열 → ISO 변환 유틸이 이미 있으면 재사용. 시간 미상이면 날짜만으로 충분.

### (c) FAQPage — `apply/page.tsx`
지원 절차를 답변엔진이 발췌하기 좋게. STEPS 배열 + 추가 Q를 FAQ로:
```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "GDG on Campus DJU는 어떻게 지원하나요?",
      acceptedAnswer: { "@type": "Answer", text: "서류 접수 → 운영진 심사 → 결과 이메일 안내 순으로 진행돼요. 로그인 없이 이 페이지에서 바로 지원서를 작성할 수 있어요." } },
    { "@type": "Question", name: "지원 자격이 있나요?",
      acceptedAnswer: { "@type": "Answer", text: "대진대학교 재학생이면 누구나 지원할 수 있어요." } }, // 사실 확인 후 확정
    { "@type": "Question", name: "언제 모집하나요?",
      acceptedAnswer: { "@type": "Answer", text: "학기 단위로 모집하며, 모집이 열리면 지원 페이지에서 바로 접수할 수 있어요." } },
  ],
}} />
```
> 답변 텍스트의 사실 관계(자격·시기)는 **운영진 확인 후 확정**. 불확실하면 해당 Q 제외.

### (d) BreadcrumbList — 하위 페이지(about/events/projects/team/apply)
```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "<페이지명>", item: `${siteUrl}/<path>` },
  ],
}} />
```
> 반복되므로 작은 헬퍼 `breadcrumb(name, path)`로 뽑아 각 페이지에서 호출해도 됨.

**수용 기준:**
- 각 페이지 HTML에 `<script type="application/ld+json">` 존재, 유효 JSON.
- Google Rich Results Test / schema.org validator 통과(경고 없이 파싱).
- Event의 `startDate`가 ISO 8601.

---

## T2-3. 답변친화 콘텐츠 (경량, 선택적이나 권장)

답변엔진 발췌율을 높이는 마크업 정리. **레이아웃·디자인 변경 없이 시맨틱만.**
- 각 공개 페이지에 `<h1>` 1개 보장(현재 랜딩은 OK, about/events/projects는 확인 필요 — 최상단 제목을 `<h1>`로).
- 핵심 정보(모집 시기, 활동 요일/장소)를 한 문장 직답 형태로 노출(이미 events desc에 있음 — 유지).

> 이 항목은 구조 변경 리스크가 있으면 **건너뛰고 별도 이슈로.** T2-1·T2-2가 우선.

---

## 검증 절차 (완료 기준)

1. `pnpm build` 통과 (타입 에러 0).
2. `pnpm dev` 후 확인:
   - `curl -s localhost:3000/robots.txt` → 크롤러 규칙 + Sitemap 라인.
   - `curl -s localhost:3000/sitemap.xml` → 공개 6경로.
   - `/`, `/about`, `/apply` HTML `<head>`에 고유 title·description·og·twitter·JSON-LD.
   - `/admin` HTML에 `noindex`.
3. JSON-LD를 [Schema Markup Validator](https://validator.schema.org/)에 붙여 파싱 검증.
4. 기존 테스트 `pnpm test` 회귀 없음.

## 파일 변경 요약
| 액션 | 파일 |
|---|---|
| 신규 | `src/app/robots.ts`, `src/app/sitemap.ts`, `src/components/JsonLd.tsx` |
| 수정 | `src/app/layout.tsx` (메타 확장) |
| 수정 | `src/app/(member)/layout.tsx`, `src/app/admin/layout.tsx`, `src/app/login/page.tsx` (noindex) |
| 수정 | `src/app/{about,team,events,projects,apply}/page.tsx` (metadata + JsonLd) |
| 수정 | 홈 JSON-LD: `src/app/page.tsx` 또는 `src/app/landing-preview/Landing.tsx` |

## 착수 전/중 확보할 값 (2026-07-20 전부 확정)
- [x] `NEXT_PUBLIC_SITE_URL` 실제 배포 도메인 — **사용자가 `.env.local` 수정 완료.** 코드는 env 참조만(하드코딩 금지)
- [x] `sameAs` GDG 공식/SNS/GitHub URL — **없음, 전부 생략.** `sameAs: []` 빈 배열 유지(추후 URL 추가)
- [x] 지원 자격·모집 시기 문구(FAQ) — **현재 `apply/page.tsx`에 있는 실제 문구·모집 안내에서만 가져올 것. 없는 조건은 지어내지 말고 FAQ 항목을 줄인다**
- [x] `projects` 배열 실데이터/샘플 — **`src/app/projects/page.tsx`의 하드코딩 `PROJECTS` 배열이 현재 유일한 소스. 그 내용 그대로 반영, 과장·창작 금지**
- [x] `team` 페이지 description — **현재 `team/page.tsx`의 실제 내용에서만 작성. 없는 인물·직함 창작 금지**
