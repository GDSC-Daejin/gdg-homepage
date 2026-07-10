"use client";

import { useState } from "react";
import Link from "next/link";
import { Space_Grotesk, Archivo } from "next/font/google";
import { createClient } from "@/lib/supabase/client";
import "./login.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

type Pos = { top?: string; bottom?: string; left?: string; right?: string };

const CONFETTI: (Pos & { size: number; color: string; r: number; radius: number; dur: string; delay: string; shadow: string })[] = [
  { top: "15%", right: "6%", size: 64, color: "#EA4335", r: 18, radius: 6, dur: "8s", delay: ".2s", shadow: "0 14px 34px rgba(234,67,53,.4)" },
  { top: "26%", right: "13%", size: 44, color: "#FBBC04", r: -12, radius: 5, dur: "9s", delay: ".6s", shadow: "0 12px 28px rgba(251,188,4,.4)" },
  { top: "9%", right: "20%", size: 34, color: "#34A853", r: 24, radius: 4, dur: "10s", delay: ".1s", shadow: "0 10px 24px rgba(52,168,83,.4)" },
  { top: "44%", left: "5%", size: 58, color: "#4285F4", r: -16, radius: 6, dur: "8.5s", delay: ".4s", shadow: "0 14px 34px rgba(66,133,244,.4)" },
  { top: "60%", left: "11%", size: 40, color: "#EA4335", r: 14, radius: 5, dur: "9.5s", delay: ".8s", shadow: "0 12px 28px rgba(234,67,53,.36)" },
  { bottom: "14%", right: "9%", size: 48, color: "#FBBC04", r: -20, radius: 5, dur: "8.8s", delay: ".3s", shadow: "0 12px 30px rgba(251,188,4,.36)" },
];

const OUTLINE_CONFETTI: (Pos & { size: number; r: number; dur: string; delay: string })[] = [
  { bottom: "24%", right: "3%", size: 30, r: 12, dur: "11s", delay: ".5s" },
  { top: "68%", left: "4%", size: 26, r: -8, dur: "10.5s", delay: ".7s" },
];

const NAV_ITEMS = [
  { label: "ABOUT", href: "/about" },
  { label: "EVENTS", href: "/events" },
  { label: "PROJECTS", href: "/projects" },
  { label: "TEAM", href: "/team" },
];

const COPY = {
  kor: "대전대학교 구글 개발자 그룹. 함께 배우고 만들고 성장하는 학생 개발자 커뮤니티에 합류하세요.",
  eng: "Google Developer Group at Daejeon University. Join a student community that learns, builds, and grows together.",
};
const CTA = {
  kor: "Google로 로그인하기",
  eng: "Sign in with Google",
};

const LEDE =
  "함께 코드를 짜고 서로의 프로젝트를 리뷰하며, 구글 기술로 아이디어를 실제 제품으로 만들어 가는 대전대학교 학생 개발자 커뮤니티입니다.";

const BADGES: { label: string; accent?: "red" | "yellow" }[] = [
  { label: "Web" },
  { label: "Android" },
  { label: "AI / ML", accent: "red" },
  { label: "Cloud", accent: "yellow" },
  { label: "Flutter" },
  { label: "UX" },
];

const FEATURES = [
  { color: "#4285F4", title: "LEARN", desc: "매주 스터디와 코드리뷰로 함께 성장" },
  { color: "#EA4335", title: "BUILD", desc: "구글 기술 핸즈온으로 실제 서비스 개발" },
  { color: "#34A853", title: "CONNECT", desc: "DevFest·해커톤으로 넓어지는 네트워크" },
];

const STATS = [
  { value: "150", suffix: "+", label: "활동 멤버" },
  { value: "12", suffix: "", label: "진행 프로젝트" },
  { value: "5", suffix: "", label: "스터디 팀" },
];

const MEETUP = {
  date: "03.14 · DevFest Warm-up",
  lines: ["매주 목요일 저녁, 세미나실 B", "웹·AI·클라우드 스터디 진행 중"],
};

const PROJECTS = [
  { title: "Campus Map AI", desc: "캠퍼스 길찾기 · Gemini 기반", color: "#4285F4" },
  { title: "DevFest Hub", desc: "행사 등록 플랫폼 · Firebase", color: "#EA4335" },
  { title: "StudyMate", desc: "스터디 매칭 앱 · Flutter", color: "#FBBC04" },
];

const TESTIMONIAL = {
  quote: "혼자 공부할 때보다 훨씬 멀리 왔어요. 첫 커밋부터 배포까지 같이 했거든요.",
  name: "김도현",
  track: "웹트랙 · 3기",
  initials: "DH",
};

const HOOK = "혼자면 막막했던 아이디어도, 여기선 팀이 되어 완성됩니다.";

const TECH_STACK = ["Android", "Firebase", "Cloud", "Flutter", "Gemini"];

function pillStyle(active: boolean): React.CSSProperties {
  return active
    ? { padding: "6px 13px", borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: ".05em", background: "#fff", color: "#111" }
    : { padding: "6px 13px", borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: ".05em", color: "rgba(255,255,255,.55)" };
}

export default function LoginPage() {
  const [lang, setLang] = useState<"kor" | "eng">("kor");

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div
      className={`${spaceGrotesk.className} login-stage`}
      style={{
        background:
          "radial-gradient(1400px 1000px at 66% 58%, #17171c 0%, #0b0b0e 58%, #060608 100%)",
      }}
    >
      {/* soft brand glow behind cluster, pinned to viewport */}
      <div
        className="login-g-f"
        style={{
          animationDelay: ".35s",
          position: "fixed",
          top: "52%",
          left: "53%",
          width: 640,
          height: 640,
          transform: "translate(-50%,-50%)",
          background:
            "radial-gradient(circle, rgba(66,133,244,.20) 0%, rgba(66,133,244,0) 62%)",
          animation: "loginGGlow 9s ease-in-out infinite",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* confetti squares (Google colors), pinned to viewport */}
      {CONFETTI.map((c, i) => (
        <div
          key={i}
          className="login-g-f"
          style={
            {
              animationDelay: ".3s",
              position: "fixed",
              top: c.top,
              bottom: c.bottom,
              right: c.right,
              left: c.left,
              width: c.size,
              height: c.size,
              background: c.color,
              "--r": `${c.r}deg`,
              transform: `rotate(${c.r}deg)`,
              borderRadius: c.radius,
              boxShadow: c.shadow,
              animation: `loginGConf ${c.dur} ease-in-out infinite ${c.delay}`,
              zIndex: 2,
              pointerEvents: "none",
            } as React.CSSProperties
          }
        />
      ))}
      {OUTLINE_CONFETTI.map((c, i) => (
        <div
          key={i}
          className="login-g-f"
          style={
            {
              animationDelay: ".3s",
              position: "fixed",
              bottom: c.bottom,
              top: c.top,
              right: c.right,
              left: c.left,
              width: c.size,
              height: c.size,
              border: "2px solid rgba(255,255,255,.2)",
              "--r": `${c.r}deg`,
              transform: `rotate(${c.r}deg)`,
              borderRadius: 4,
              animation: `loginGConf ${c.dur} ease-in-out infinite ${c.delay}`,
              zIndex: 2,
              pointerEvents: "none",
            } as React.CSSProperties
          }
        />
      ))}

      {/* top nav */}
      <div className="login-g-f login-nav" style={{ animationDelay: ".15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", gap: 3 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4285F4" }} />
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#EA4335" }} />
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#FBBC04" }} />
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#34A853" }} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-.01em", color: "#fff" }}>
            GDG <span style={{ opacity: 0.55, fontWeight: 500 }}>on Campus · DJU</span>
          </span>
        </div>
        <div
          className="login-nav-mid"
          style={{
            alignItems: "center",
            gap: 4,
            padding: 6,
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 999,
            background: "rgba(255,255,255,.03)",
            backdropFilter: "blur(8px)",
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="login-navlink"
              style={{
                padding: "7px 15px",
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: ".04em",
                color: "rgba(255,255,255,.82)",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <span
          className="login-navlink"
          style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: ".05em", color: "rgba(255,255,255,.7)" }}
        >
          MEMBERS
        </span>
      </div>

      {/* left column: eyebrow, headline, value prop, tech badges, learn/build/connect */}
      <div className="login-left">
        <div className="login-hero">
          <div
            className="login-g-r"
            style={{
              animationDelay: ".2s",
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 22,
              padding: "7px 14px",
              border: "1px solid rgba(255,255,255,.14)",
              borderRadius: 999,
              background: "rgba(255,255,255,.04)",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#34A853", boxShadow: "0 0 10px #34A853" }} />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", color: "rgba(255,255,255,.78)" }}>
              2026 신규 멤버 모집 중
            </span>
          </div>
          <h1
            className={`login-g-r login-head ${archivo.className}`}
            style={{ animationDelay: ".28s", margin: 0, fontWeight: 900, letterSpacing: "-.03em" }}
          >
            <span
              style={{
                display: "block",
                background: "linear-gradient(180deg,#ffffff,#c8c8ce)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              BUILD WITH
            </span>
            <span
              style={{
                display: "block",
                background: "linear-gradient(92deg,#4285F4 0%,#EA4335 34%,#FBBC04 64%,#34A853 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              GOOGLE.
            </span>
          </h1>
        </div>

        <p className="login-g-r login-lede" style={{ animationDelay: ".32s" }}>
          {LEDE}
        </p>

        <div className="login-g-r login-badges" style={{ animationDelay: ".36s" }}>
          {BADGES.map((b) => (
            <span
              key={b.label}
              className={`login-badge ${b.accent ? `login-badge--${b.accent}` : ""}`}
            >
              {b.label}
            </span>
          ))}
        </div>

        <div className="login-g-r login-features" style={{ animationDelay: ".4s" }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="login-feature">
              <span className="login-feature-dot" style={{ background: f.color }} />
              <div>
                <div className="login-feature-title">{f.title}</div>
                <div className="login-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* center 3D orb cluster */}
      <div className="login-g-f login-orb" style={{ animationDelay: ".42s" }}>
        <div
          style={{
            position: "absolute",
            top: "8%",
            left: "16%",
            width: "45%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "radial-gradient(circle at 34% 26%, #b7d3ff 0%, #4285F4 46%, #1553c0 100%)",
            boxShadow: "0 34px 80px rgba(66,133,244,.5),inset -14px -18px 40px rgba(0,0,0,.28),inset 14px 14px 32px rgba(255,255,255,.5)",
            animation: "loginGOrb1 9s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "55%",
            width: "31%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "radial-gradient(circle at 34% 26%, #ffb0a8 0%, #EA4335 48%, #a5231a 100%)",
            boxShadow: "0 30px 70px rgba(234,67,53,.5),inset -12px -16px 34px rgba(0,0,0,.28),inset 12px 12px 28px rgba(255,255,255,.42)",
            animation: "loginGOrb2 11s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "2%",
            left: "36%",
            width: "36%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "radial-gradient(circle at 34% 26%, #ffe89a 0%, #FBBC04 50%, #cf9100 100%)",
            boxShadow: "0 30px 72px rgba(251,188,4,.5),inset -12px -16px 36px rgba(0,0,0,.24),inset 12px 12px 30px rgba(255,255,255,.55)",
            animation: "loginGOrb3 10s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "11%",
            left: 0,
            width: "29%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "radial-gradient(circle at 34% 26%, #a6ecbf 0%, #34A853 50%, #17662f 100%)",
            boxShadow: "0 28px 66px rgba(52,168,83,.5),inset -11px -14px 30px rgba(0,0,0,.28),inset 11px 11px 26px rgba(255,255,255,.42)",
            animation: "loginGOrb4 12s ease-in-out infinite",
          }}
        />
      </div>

      {/* right column: hook line + tech stack, next meetup, featured projects, testimonial */}
      <div className="login-g-r login-right-panel" style={{ animationDelay: ".46s" }}>
        <div className="login-center-bottom">
          <p className="login-hook">{HOOK}</p>
          <div className="login-stack-row">
            {TECH_STACK.map((t) => (
              <span key={t} className="login-stack-pill">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="login-meetup-badge">
            <span className="login-meetup-label">NEXT MEETUP</span>
            <span className="login-meetup-date">{MEETUP.date}</span>
          </div>
          <div className="login-meetup-lines">
            {MEETUP.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>

        <div>
          <div className="login-panel-label">FEATURED PROJECTS</div>
          <div className="login-projects">
            {PROJECTS.map((p) => (
              <div key={p.title} className="login-project">
                <span className="login-project-dot" style={{ background: p.color }} />
                <div>
                  <div className="login-project-title">{p.title}</div>
                  <div className="login-project-desc">{p.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="login-testimonial-quote">&ldquo;{TESTIMONIAL.quote}&rdquo;</p>
          <div className="login-testimonial-who">
            <span className="login-testimonial-avatar">{TESTIMONIAL.initials}</span>
            <div>
              <div className="login-testimonial-name">{TESTIMONIAL.name}</div>
              <div className="login-testimonial-track">{TESTIMONIAL.track}</div>
            </div>
          </div>
        </div>
      </div>

      {/* bottom-left: stats + lang toggle */}
      <div className="login-bottom-left">
        <div className="login-g-r login-stats" style={{ animationDelay: ".5s" }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="login-stat-value">
                {s.value}
                {s.suffix && <span>{s.suffix}</span>}
              </div>
              <div className="login-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="login-g-f login-langrow" style={{ animationDelay: ".7s" }}>
          <span className="login-langpill" onClick={() => setLang("kor")} style={pillStyle(lang === "kor")}>
            KOR
          </span>
          <span className="login-langpill" onClick={() => setLang("eng")} style={pillStyle(lang === "eng")}>
            ENG
          </span>
        </div>
      </div>

      {/* copy */}
      <p className="login-g-r login-copy" style={{ animationDelay: ".55s", fontFamily: "var(--font-sans)" }}>
        {COPY[lang]}
      </p>

      {/* CTA */}
      <button
        onClick={handleGoogleLogin}
        className={`login-g-r login-btnG login-cta ${archivo.className}`}
        style={{ animationDelay: ".6s" }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#fff",
            flex: "none",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
            <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
          </svg>
        </span>
        <span style={{ flex: 1, textAlign: "left", fontWeight: 800, fontSize: "clamp(17px,2vw,24px)", letterSpacing: "-.01em", color: "#fff" }}>
          {CTA[lang]}
        </span>
        <span
          className="login-btnG-arw"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 42,
            height: 42,
            borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,.45)",
            color: "#fff",
            flex: "none",
            transition: "transform .18s ease",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </button>

      {/* footnote */}
      <div className="login-g-f login-footnote" style={{ animationDelay: ".8s" }}>
        © 2026 GDG on Campus · Daejeon University
      </div>
    </div>
  );
}
