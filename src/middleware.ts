import { NextResponse, type NextRequest } from "next/server";

/**
 * Portal middleware — security headers + redirect root.
 * Auth is validated client-side (localStorage JWT) + server-side by Hub API.
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Root → dashboard
  if (path === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();

  // Security headers (belt-and-suspenders with next.config.ts headers)
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
