import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 · GDG on Campus DJU",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "2026년 7월 21일";
const CONTACT = "gdgocdju@gmail.com";

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "64px clamp(20px, 5vw, 40px) 96px",
        lineHeight: 1.7,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
        개인정보처리방침
      </h1>
      <p style={{ color: "#888", marginBottom: 40, fontSize: 14 }}>
        시행일: {UPDATED}
      </p>

      <p style={{ marginBottom: 32 }}>
        GDG on Campus 대진대학교(이하 &ldquo;GDG DJU&rdquo;)는 이용자의 개인정보를
        중요하게 생각하며, 「개인정보 보호법」을 준수합니다. 본 방침은 GDG DJU
        웹사이트에서 어떤 정보를 어떻게 수집·이용하는지 안내합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <ul>
          <li>
            <strong>Google 계정 로그인</strong>: 이메일 주소, 이름, 프로필 사진
            (Google OAuth를 통해 제공받음)
          </li>
          <li>
            <strong>모집·활동</strong>: 지원서에 직접 입력한 정보, 출석 기록 등
            커뮤니티 운영에 필요한 정보
          </li>
          <li>
            <strong>자동 수집</strong>: 방문 기록, 기기·브라우저 정보, 쿠키
            (Google Analytics를 통해 수집)
          </li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 수집 및 이용 목적">
        <ul>
          <li>회원 식별 및 로그인 인증</li>
          <li>신규 멤버 모집 및 커뮤니티 운영·관리</li>
          <li>서비스 이용 통계 분석 및 개선</li>
        </ul>
      </Section>

      <Section title="3. 보유 및 이용 기간">
        <p>
          수집한 개인정보는 이용 목적이 달성되거나 회원 탈퇴·활동 종료 시 지체 없이
          파기합니다. 다만 관련 법령에서 보존을 요구하는 경우 해당 기간 동안
          보관합니다.
        </p>
      </Section>

      <Section title="4. 개인정보 처리의 위탁 및 제3자 제공">
        <p>원활한 서비스 제공을 위해 아래 서비스를 이용합니다.</p>
        <ul>
          <li>
            <strong>Google</strong> (LLC): 계정 로그인 인증(OAuth) 및 방문 통계
            분석(Google Analytics)
          </li>
          <li>
            <strong>Supabase</strong> (Supabase, Inc.): 데이터 저장 및 서비스
            호스팅
          </li>
        </ul>
        <p>
          위 목적 외에 이용자의 동의 없이 개인정보를 외부에 제공하지 않습니다.
        </p>
      </Section>

      <Section title="5. 쿠키 및 분석 도구">
        <p>
          본 사이트는 방문 통계 분석을 위해 Google Analytics 4를 사용하며, 이
          과정에서 쿠키가 사용됩니다. 수집된 정보는 이용자 개인을 특정하지 않는
          통계 목적으로만 활용됩니다. (운영자용 관리자 페이지는 분석 대상에서
          제외됩니다.)
        </p>
        <p>
          쿠키 저장을 원치 않으시면 브라우저 설정에서 쿠키를 차단하거나, Google이
          제공하는{" "}
          <a
            href="https://tools.google.com/dlpage/gaoptout"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Analytics 차단 브라우저 부가기능
          </a>
          을 설치하여 수집을 거부할 수 있습니다.
        </p>
      </Section>

      <Section title="6. 정보주체의 권리">
        <p>
          이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를
          요구할 수 있으며, 아래 문의처로 연락하시면 지체 없이 조치합니다.
        </p>
      </Section>

      <Section title="7. 문의처">
        <p>
          개인정보 관련 문의:{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </Section>

      <p style={{ marginTop: 48 }}>
        <Link href="/">← 홈으로</Link>
      </p>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </section>
  );
}
