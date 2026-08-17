/**
 * Portal API client, talks to hub.stevin.ai/api/portal/*
 * Now uses Supabase Auth tokens (synced with Desk).
 *
 * Foutmeldingen komen via toast.error(err.message) op elk scherm terug, dus
 * ze volgen de klanttaal. Die komt uit dezelfde module-cache als useLanguage,
 * gelezen met currentLang() omdat een hook hier niet mag.
 */

import { createClient } from "./supabase-browser";
import { getToken } from "./auth";
import { currentLang, pick } from "./useLanguage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://hub.stevin.ai";

export async function portalFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Check portal JWT first (fast, sync), skip Supabase if we have one
  let token = getToken();

  // If no portal token, try Supabase session (Google OAuth flow)
  if (!token || token === "") {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}/api/portal${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  const lang = currentLang();

  if (res.status === 401) {
    // Clear all auth state and redirect to login
    const { clearAuth } = await import("./auth");
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error(
      pick(lang, {
        nl: "Sessie verlopen. Log opnieuw in.",
        en: "Session expired. Please log in again.",
      }),
    );
  }

  if (!res.ok) {
    let message = pick(lang, {
      nl: `Fout: ${res.status}`,
      en: `Error: ${res.status}`,
    });
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}
