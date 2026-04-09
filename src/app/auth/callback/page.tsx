"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handle() {
      const supabase = createClient();

      // Handle OAuth code exchange (PKCE flow)
      const code = searchParams.get("code");
      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        if (result.error) {
          console.error("[Auth] Code exchange failed:", result.error.message);
          router.push("/login?error=auth_failed");
          return;
        }
        // Success — session is now stored, go to dashboard
        router.push("/dashboard");
        return;
      }

      // Handle hash fragment (implicit flow fallback)
      if (typeof window !== "undefined" && window.location.hash) {
        // Supabase might return tokens in the hash — let the client handle it
        const { data, error } = await supabase.auth.getSession();
        if (data.session) {
          router.push("/dashboard");
          return;
        }
        if (error) console.error("[Auth] Hash session error:", error.message);
      }

      // No code, no hash — check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/dashboard");
      } else {
        console.error("[Auth] No session found after callback");
        router.push("/login?error=no_session");
      }
    }
    handle();
  }, [router, searchParams]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Even geduld...</p>
      </div>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
