/**
 * Portal auth client — Supabase Auth (synced with Desk).
 * Migrated from custom JWT to Supabase for single auth system.
 * Function signatures preserved for backward compatibility.
 */

import { createClient } from "./supabase-browser";

const CLIENT_KEY = "stevin-portal-client";
const TOKEN_KEY = "stevin-portal-token";

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
  if (typeof window === "undefined") return null;

  // Check Portal JWT first (magic link flow)
  const portalToken = localStorage.getItem(TOKEN_KEY);
  if (portalToken) return portalToken;

  // Fallback: Supabase session (Google OAuth flow)
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

export function setAuth(token: string, user: PortalUser, client: PortalClient | null) {
  // Store Portal JWT (magic link flow)
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (client) localStorage.setItem(CLIENT_KEY, JSON.stringify(client));
}

export function clearAuth() {
  const supabase = createClient();
  supabase.auth.signOut();
  localStorage.removeItem(CLIENT_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isImpersonating(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.has("_t");
}
