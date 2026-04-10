"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { setAuth } from "@/lib/auth";

/**
 * /auth/complete — Session is already established (code exchange done server-side).
 * This page fetches portal info from Hub and stores it in localStorage.
 */
export default function AuthCompletePage() {
  const router = useRouter();

  useEffect(() => {
    async function hydrate() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error("[Auth] No session found after OAuth complete");
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
    hydrate();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Even geduld...</p>
      </div>
    </div>
  );
}
