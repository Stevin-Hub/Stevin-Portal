import { NextResponse, type NextRequest } from "next/server";

/**
 * Portal proxy (middleware).
 * NO server-side auth check, portal uses JWT in localStorage,
 * which is validated client-side + by the Hub API.
 *
 * This proxy handles:
 * 1. Redirecting / to /dashboard
 * 2. Setting security headers
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Root → dashboard
  if (path === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  // Lokaal ontwikkelen tegen een Hub op localhost:3001 (de poort van bot.ts).
  // In productie blijft connect-src ongewijzigd; dit voegt alleen in
  // development een localhost-bron toe, anders blokkeert de browser elke
  // API-aanroep zodra NEXT_PUBLIC_API_URL naar localhost wijst.
  const lokaleHub = process.env.NODE_ENV === "development" ? " http://localhost:3001" : "";
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.clarity.ms https://scripts.clarity.ms; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https:; connect-src 'self' https://hub.stevin.ai https://*.supabase.co https://accounts.google.com https://www.clarity.ms https://*.clarity.ms${lokaleHub};`,
  );

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
