/**
 * Portal auth client — Supabase Auth (synced with Desk).
 * Migrated from custom JWT to Supabase for single auth system.
 * Function signatures preserved for backward compatibility.
 */

import { createClient } from "./supabase-browser";

const CLIENT_KEY = "stevin-portal-client";

export interface PortalUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

export interface PortalClient {
  id: string;
  name: string;
  slug: string;
}

export function getToken(): string | null {
  // Synchronous fallback — check localStorage for cached token
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sb-rhxhhgexinfjbdtdmgja-auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.access_token || null;
  } catch {
    return null;
  }
}

export function getUser(): PortalUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("sb-rhxhhgexinfjbdtdmgja-auth-token");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const user = parsed?.user;
    if (!user) return null;
    return {
      id: user.id,
      email: user.email || "",
      displayName: user.user_metadata?.full_name || user.user_metadata?.name || null,
      role: user.role || "authenticated",
    };
  } catch {
    return null;
  }
}

export function getClient(): PortalClient | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CLIENT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(_token: string, user: PortalUser, client: PortalClient | null) {
  // Token is managed by Supabase — only store client info
  if (client) localStorage.setItem(CLIENT_KEY, JSON.stringify(client));
}

export function clearAuth() {
  const supabase = createClient();
  supabase.auth.signOut();
  localStorage.removeItem(CLIENT_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isImpersonating(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("_t");
}
