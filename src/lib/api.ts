/**
 * Portal API client — talks to hub.stevin.ai/api/portal/*
 * Uses JWT from localStorage (NOT Supabase session).
 */

import { getToken, clearAuth } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://hub.stevin.ai";

export async function portalFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_URL}/api/portal${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  if (res.status === 401) {
    // Token expired or invalid — force re-login
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
