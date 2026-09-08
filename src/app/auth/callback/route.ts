import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Token in de link zelf (W-069). De PKCE-code werkt alleen in de browser die de
  // link aanvroeg, want de verifier staat in een cookie. Koen opende de link in
  // een andere browser en zag stil het inlogscherm terug (8 sep 2026). Met een
  // token_hash in de mail (Supabase-template: {{ .RedirectTo }}?token_hash=
  // {{ .TokenHash }}&type=magiclink) werkt de link overal, net als in Desk.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (tokenHash && (type === "magiclink" || type === "email")) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options })); } catch { /* Server Component */ }
          },
        },
      }
    );
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}/auth/complete`);
    console.error("[Auth] Token verify failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, { ...options })
              );
            } catch {
              // Ignore, called from Server Component
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Code exchanged, session is now in cookies.
      // Redirect to /auth/complete which hydrates localStorage with portal info.
      return NextResponse.redirect(`${origin}/auth/complete`);
    }

    console.error("[Auth] Code exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // No code, maybe error from provider
  const error = searchParams.get("error");
  const errorDesc = searchParams.get("error_description");
  if (error) {
    console.error(`[Auth] Provider error: ${error}, ${errorDesc}`);
  }

  return NextResponse.redirect(`${origin}/login?error=no_code`);
}
