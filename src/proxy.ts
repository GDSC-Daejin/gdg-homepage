import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasAuthCookie } from "@/lib/supabase/has-auth-cookie";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-gdg-user-id");

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
  response = NextResponse.next({ request: { headers: requestHeaders } });
  refreshedCookies.forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
