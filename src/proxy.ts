import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE_HEADER } from "@/lib/demo";
import { hasAuthCookie } from "@/lib/supabase/has-auth-cookie";

const TOUR_PATHS = [
  /^\/tour\/landing$/,
  /^\/admin(?:\/(?:analytics|applications|attendance|bots|budget|dev|events|groups|inquiries|interview-questions|members|notices|places|points|settings|surveys)(?:\/.*)?)?$/,
  /^\/schedule(?:\/.*)?$/,
];

function isTourPath(pathname: string): boolean {
  return TOUR_PATHS.some((path) => path.test(pathname));
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-gdg-user-id");
  requestHeaders.delete(DEMO_MODE_HEADER);
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/tour/")) {
    const destination = pathname.slice("/tour".length);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new NextResponse(null, { status: 403 });
    }
    requestHeaders.set(DEMO_MODE_HEADER, "1");
    if (destination === "/landing") {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    if (!isTourPath(destination)) {
      return NextResponse.redirect(new URL("/tour/admin", request.url));
    }
    const url = request.nextUrl.clone();
    url.pathname = destination;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  const referer = request.headers.get("referer");
  if (referer && isTourPath(pathname) && new URL(referer).pathname.startsWith("/tour/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/tour${pathname}`;
    return NextResponse.redirect(url);
  }

  if (!hasAuthCookie(request.cookies.getAll())) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(updatedCookies) {
          updatedCookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          updatedCookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims: ECC(비대칭) JWT를 JWKS로 로컬 검증 → Auth 서버 왕복 제거.
  // 토큰 만료 시에만 내부 getSession이 리프레시하며 쿠키(setAll)를 갱신한다.
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.sub) requestHeaders.set("x-gdg-user-id", data.claims.sub);

  const refreshedCookies = response.cookies.getAll();
  response = data?.claims.sub && pathname === "/"
    ? NextResponse.rewrite(new URL("/dashboard", request.url), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  refreshedCookies.forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
