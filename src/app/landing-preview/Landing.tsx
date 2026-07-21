import Link from "next/link";
import { GoogleLoginButton } from "./GoogleLoginButton";
import "./landing-preview.css";

const NAV_ITEMS = [
  { label: "소개", href: "/about" },
  { label: "이벤트", href: "/events" },
  { label: "프로젝트", href: "/projects" },
  { label: "운영진", href: "/team" },
];

const TICKER = [
  "정기세션",
  "스터디",
  "코드리뷰",
  "해커톤",
  "모각코",
  "라이트닝 토크",
  "데모 데이",
  "네트워킹",
];

// 로그인 페이지(login-orb)의 4색 3D 오브 클러스터를 그대로 가져옴
const ORBS = [
  { top: "8%", left: "16%", bottom: undefined, size: "45%", grad: "#b7d3ff 0%, #4285F4 46%, #1553c0 100%", shadow: "0 28px 64px rgba(66,133,244,.5),inset -14px -18px 40px rgba(0,0,0,.28)", anim: "nbOrb1 9s ease-in-out infinite" },
  { top: "0", left: "55%", bottom: undefined, size: "31%", grad: "#ffb0a8 0%, #EA4335 48%, #a5231a 100%", shadow: "0 24px 56px rgba(234,67,53,.5),inset -12px -16px 34px rgba(0,0,0,.28)", anim: "nbOrb2 11s ease-in-out infinite" },
  { top: undefined, left: "36%", bottom: "2%", size: "36%", grad: "#ffe89a 0%, #FBBC04 50%, #cf9100 100%", shadow: "0 24px 58px rgba(251,188,4,.5),inset -12px -16px 36px rgba(0,0,0,.24)", anim: "nbOrb3 10s ease-in-out infinite" },
  { top: undefined, left: "0", bottom: "11%", size: "29%", grad: "#a6ecbf 0%, #34A853 50%, #17662f 100%", shadow: "0 22px 52px rgba(52,168,83,.5),inset -11px -14px 30px rgba(0,0,0,.28)", anim: "nbOrb4 12s ease-in-out infinite" },
];

const STATS = [
  { value: "150+", label: "활동 멤버" },
  { value: "12", label: "진행 프로젝트" },
  { value: "5", label: "스터디 팀" },
  { value: "월 1회", label: "정기세션" },
];

const PROJECTS = [
  { no: "01", title: "Campus Map AI", desc: "캠퍼스 길찾기 · Gemini 기반", color: "#4285F4" },
  { no: "02", title: "Event Hub", desc: "행사 등록 플랫폼 · Firebase", color: "#EA4335" },
  { no: "03", title: "StudyMate", desc: "스터디 매칭 앱 · Flutter", color: "#FBBC04" },
];

export default function Landing() {
  return (
    <div className="nb">
      {/* ── 네비게이션 ─────────────────────────── */}
      <header className="nb-nav">
        <Link href="/" className="nb-brand">
          <span className="nb-brand-mark" aria-hidden>
            <i style={{ background: "#4285F4" }} />
            <i style={{ background: "#EA4335" }} />
            <i style={{ background: "#FBBC04" }} />
            <i style={{ background: "#34A853" }} />
          </span>
          <span className="nb-brand-text">
            GDG on Campus <em>DJU</em>
          </span>
        </Link>
        <nav className="nb-nav-links">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="nb-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <GoogleLoginButton className="nb-nav-cta" />
      </header>

      <main>
        {/* ── 히어로 ─────────────────────────── */}
        <section className="nb-hero">
          <div className="nb-orb nb-in" style={{ animationDelay: ".42s" }} aria-hidden>
            {ORBS.map((o, i) => (
              <div
                key={i}
                className="nb-orb-ball"
                style={{
                  top: o.top,
                  bottom: o.bottom,
                  left: o.left,
                  width: o.size,
                  background: `radial-gradient(circle at 34% 26%, ${o.grad})`,
                  boxShadow: o.shadow,
                  animation: o.anim,
                }}
              />
            ))}
          </div>
          <p className="nb-kicker nb-in" style={{ animationDelay: ".05s" }}>
            <span className="nb-kicker-pulse" aria-hidden />
            2026 신규 멤버 모집 중 — 대진대학교
          </p>
          <h1 className="nb-display" aria-label="배우고, 만들고, 배포한다.">
            <span className="nb-line nb-line--soft nb-in" style={{ animationDelay: ".12s" }}>
              배우고<i className="dot" style={{ color: "#4285F4" }}>,</i>
            </span>
            <span className="nb-line nb-line--soft nb-in" style={{ animationDelay: ".22s" }}>
              만들고<i className="dot" style={{ color: "#FBBC04" }}>,</i>
            </span>
            <span className="nb-line nb-in" style={{ animationDelay: ".32s" }}>
              <em>배포한다</em>
              <i className="dot" style={{ color: "#34A853" }}>.</i>
            </span>
          </h1>
          <div className="nb-hero-foot nb-in" style={{ animationDelay: ".45s" }}>
            <p className="nb-lede">
              구글 기술로 함께 성장하는 학생 개발자 커뮤니티.
              <br />
              혼자 끝내지 못했던 프로젝트, 여기서는 배포까지 갑니다.
            </p>
            <div className="nb-cta-row">
              <Link href="/apply" className="nb-btn nb-btn--fill">
                지원하기 <span aria-hidden>↗</span>
              </Link>
              <Link href="/about" className="nb-btn nb-btn--line">
                활동 둘러보기
              </Link>
            </div>
          </div>
        </section>

        {/* ── 티커 ─────────────────────────── */}
        <div className="nb-ticker" aria-hidden>
          <div className="nb-ticker-track">
            {[0, 1].map((dup) => (
              <span key={dup} className="nb-ticker-group">
                {TICKER.map((t, i) => (
                  <span key={t} className="nb-ticker-item">
                    {t}
                    <i
                      className="nb-ticker-dot"
                      style={{
                        background: ["#4285F4", "#EA4335", "#FBBC04", "#34A853"][i % 4],
                      }}
                    />
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ── 스탯 ─────────────────────────── */}
        <section className="nb-stats">
          {STATS.map((s) => (
            <div key={s.label} className="nb-stat">
              <div className="nb-stat-value">{s.value}</div>
              <div className="nb-stat-label">{s.label}</div>
            </div>
          ))}
        </section>

        {/* ── 활동: 벤토 그리드 ─────────────────────────── */}
        <section className="nb-section">
          <div className="nb-section-head">
            <span className="nb-index">01</span>
            <h2 className="nb-h2">한 학기가 이렇게 흘러갑니다</h2>
          </div>
          <div className="nb-bento">
            <article className="nb-cell nb-cell--wide">
              <span className="nb-cell-tag" style={{ color: "#8ab4f8" }}>
                매주 목요일
              </span>
              <h3 className="nb-cell-title">정기세션</h3>
              <p className="nb-cell-desc">
                최신 구글 기술과 개발 트렌드를 발표와 핸즈온으로. 발표자도
                청중도 모두 멤버 — 무대는 누구에게나 열려 있어요.
              </p>
              <div className="nb-cell-art nb-cell-art--session" aria-hidden>
                <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
              </div>
            </article>
            <article className="nb-cell">
              <span className="nb-cell-tag" style={{ color: "#f28b82" }}>
                소규모 팀
              </span>
              <h3 className="nb-cell-title">스터디 · 코드리뷰</h3>
              <p className="nb-cell-desc">
                관심 분야별 팀에서 코드리뷰를 주고받으며 꾸준히.
              </p>
            </article>
            <article className="nb-cell">
              <span className="nb-cell-tag" style={{ color: "#fdd663" }}>
                학기 말
              </span>
              <h3 className="nb-cell-title">해커톤 · 데모 데이</h3>
              <p className="nb-cell-desc">
                첫 커밋부터 배포까지, 만든 것을 세상에 보여주는 날.
              </p>
            </article>
          </div>
        </section>

        {/* ── 프로젝트: 인덱스 리스트 ─────────────────────────── */}
        <section className="nb-section">
          <div className="nb-section-head">
            <span className="nb-index">02</span>
            <h2 className="nb-h2">멤버들이 만든 것들</h2>
          </div>
          <div className="nb-rows">
            {PROJECTS.map((p) => (
              <Link key={p.title} href="/projects" className="nb-row">
                <span className="nb-row-no">{p.no}</span>
                <span className="nb-row-title">
                  <i className="nb-row-dot" style={{ background: p.color }} />
                  {p.title}
                </span>
                <span className="nb-row-desc">{p.desc}</span>
                <span className="nb-row-arw" aria-hidden>
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 후기 ─────────────────────────── */}
        <section className="nb-section">
          <div className="nb-section-head">
            <span className="nb-index">03</span>
            <h2 className="nb-h2">먼저 와본 사람의 말</h2>
          </div>
          <figure className="nb-quote">
            <blockquote>
              &ldquo;혼자 공부할 때보다 훨씬 멀리 왔어요.
              <br />첫 커밋부터 배포까지 <em>같이</em> 했거든요.&rdquo;
            </blockquote>
            <figcaption>
              <span className="nb-quote-avatar" aria-hidden>
                AQ
              </span>
              아쿠아 — 프론트엔드 · 2기
            </figcaption>
          </figure>
        </section>

        {/* ── 최종 CTA ─────────────────────────── */}
        <section className="nb-final">
          <h2 className="nb-final-title">
            2026년,
            <br />
            같이 만들어요<span style={{ color: "#4285F4" }}>.</span>
          </h2>
          <p className="nb-final-sub">지원서 작성은 5분이면 충분해요.</p>
          <div className="nb-cta-row nb-cta-row--center">
            <Link href="/apply" className="nb-btn nb-btn--fill nb-btn--big">
              2026 신규 멤버 지원하기 <span aria-hidden>↗</span>
            </Link>
            <GoogleLoginButton className="nb-btn nb-btn--line" />
          </div>
        </section>
      </main>

      <footer className="nb-footer">
        <span>
          © 2026 GDG on Campus · Daejin University
          {" · "}
          <Link href="/privacy" className="nb-footer-link">
            개인정보처리방침
          </Link>
        </span>
        <span className="nb-footer-dots" aria-hidden>
          <i style={{ background: "#4285F4" }} />
          <i style={{ background: "#EA4335" }} />
          <i style={{ background: "#FBBC04" }} />
          <i style={{ background: "#34A853" }} />
        </span>
      </footer>
    </div>
  );
}
