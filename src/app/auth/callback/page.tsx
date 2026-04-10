"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { setAuth } from "@/lib/auth";

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
      }

      // Handle hash fragment (implicit flow fallback)
      if (!code && typeof window !== "undefined" && window.location.hash) {
        await supabase.auth.getSession();
      }

      // Get session and store client info
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("[Auth] No session found after callback");
        router.push("/login?error=no_session");
        return;
      }

      // Fetch client info from Hub and store in localStorage
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://hub.stevin.ai";
        const res = await fetch(`${API_URL}/api/portal/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.client) {
            setAuth(session.access_token, {
              id: data.user?.id || session.user.id,
              email: session.user.email || "",
              displayName: data.user?.displayName || session.user.user_metadata?.full_name || null,
              role: data.user?.role || "authenticated",
            }, data.client);
          }
        }
      } catch (err) {
        console.error("[Auth] Failed to fetch client info:", err);
      }

      router.push("/dashboard");
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
