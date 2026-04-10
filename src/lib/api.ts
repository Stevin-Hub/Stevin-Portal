/**
 * Portal API client — talks to hub.stevin.ai/api/portal/*
 * Now uses Supabase Auth tokens (synced with Desk).
 */

import { createClient } from "./supabase-browser";
import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://hub.stevin.ai";

export async function portalFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  // Check portal JWT first (fast, sync) — skip Supabase if we have one
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

  if (res.status === 401) {
    // Clear all auth state and redirect to login
    const { clearAuth } = await import("./auth");
    clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Sessie verlopen. Log opnieuw in.");
  }

  if (!res.ok) {
    let message = `Fout: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}
