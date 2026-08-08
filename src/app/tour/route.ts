import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/tour/landing", request.url));
  response.cookies.delete("demo_mode");
  return response;
}
