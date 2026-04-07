/**
 * Portal API client — talks to hub.stevin.ai/api/portal/*
 * Now uses Supabase Auth tokens (synced with Desk).
 */

import { createClient } from "./supabase-browser";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://hub.stevin.ai";

export async function portalFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}/api/portal${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  if (res.status === 401) {
    await supabase.auth.signOut();
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
