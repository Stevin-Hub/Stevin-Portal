"use client";

/**
 * /auth/complete, Session is already established (code exchange done server-side).
 * This page fetches portal info from Hub and stores it in localStorage.
 *
 * De klanttaal uit clients.advisor_language is hier nog niet bekend, want /me
 * is nog niet opgehaald. Daarom kiest dit scherm op de browsertaal, precies
 * zoals het inlogscherm: begint navigator.language met "nl", dan Nederlands,
 * anders Engels. Weet de browser niets, dan blijft het Nederlands.
 *
 * De keuze staat bewust in een effect en niet in de eerste render, zodat
 * server en client dezelfde HTML opleveren. In datzelfde effect gaat ook
 * document.documentElement.lang mee, want de root-layout zet lang="nl" en dit
 * scherm valt buiten het dashboard.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { setAuth } from "@/lib/auth";
import type { Lang } from "@/lib/useLanguage";

interface Copy {
  loading: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    loading: "Even geduld...",
  },
  en: {
    loading: "One moment...",
  },
};

export default function AuthCompletePage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("nl");

  useEffect(() => {
    const browserLang = typeof navigator !== "undefined" ? navigator.language : "";
    if (!browserLang) return;
    const next: Lang = browserLang.toLowerCase().startsWith("nl") ? "nl" : "en";
    setLang(next);
    document.documentElement.lang = next;
  }, []);

  const c = COPY[lang];

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
        <p className="text-sm text-muted-foreground">{c.loading}</p>
      </div>
    </div>
  );
}
