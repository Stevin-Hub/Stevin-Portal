/**
 * Portal auth client — JWT-based (NOT Supabase Auth).
 * Tokens stored in localStorage, attached to every API call.
 */

const TOKEN_KEY = "stevin-portal-token";
const USER_KEY = "stevin-portal-user";
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
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): PortalUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getClient(): PortalClient | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CLIENT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function setAuth(token: string, user: PortalUser, client: PortalClient | null) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (client) localStorage.setItem(CLIENT_KEY, JSON.stringify(client));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(CLIENT_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/**
 * Check if current session is a consultant impersonation.
 * Decodes JWT payload (no verification — that's server-side).
 */
export function isImpersonating(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.impersonate === true;
  } catch {
    return false;
  }
}
