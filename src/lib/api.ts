/**
 * Portal API client, talks to hub.stevin.ai/api/portal/*
 * Now uses Supabase Auth tokens (synced with Desk).
 *
 * Foutmeldingen komen via toast.error(err.message) op elk scherm terug, dus
 * ze volgen de klanttaal. Die komt uit dezelfde module-cache als useLanguage,
 * gelezen met currentLang() omdat een hook hier niet mag.
 *
 * De Hub stuurt bij een fout naast de tekst een machineleesbare errorCode mee.
 * Die code wordt hier een keer centraal vertaald en blijft als .code op de
 * gegooide Error staan, zodat schermen op de code kunnen testen in plaats van
 * op de tekst.
 *
 * Volgorde bij een fout:
 * 1. bekende code, dan de vertaalde zin uit ERROR_COPY;
 * 2. onbekende code, dan een generieke zin in de taal van de klant. De
 *    servertekst is bij veel routes Engels ("Not found", "Already decided") en
 *    die mag een Nederlandse klant niet lezen;
 * 3. helemaal geen code, dan blijft de servertekst staan. Dat is de terugval
 *    voor Hub-versies van voor de errorCode-afspraak.
 */

import { createClient } from "./supabase-browser";
import { getToken } from "./auth";
import { currentLang, pick, type Lang } from "./useLanguage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://hub.stevin.ai";

/** Codes uit het gedeelde contract met de Hub (src/routes/portal.ts). */
export type PortalErrorCode =
  | "account_load_failed"
  | "account_not_active"
  | "action_confirm_failed"
  | "action_request_failed"
  | "action_requests_load_failed"
  | "already_decided"
  | "approval_load_failed"
  | "approval_not_found"
  | "approvals_load_failed"
  | "brain_load_failed"
  | "budget_load_failed"
  | "chat_load_failed"
  | "chat_unavailable"
  | "client_not_found"
  | "client_without_organization"
  | "content_id_required"
  | "creator_archive_load_failed"
  | "creator_audience_load_failed"
  | "creator_decisions_load_failed"
  | "creator_retention_load_failed"
  | "creator_signals_load_failed"
  | "creator_summary_load_failed"
  | "creator_traffic_load_failed"
  | "creator_videos_load_failed"
  | "dashboard_load_failed"
  | "decision_failed"
  | "email_required"
  | "feedback_failed"
  | "feedback_message_required"
  | "feedback_required"
  | "feedback_too_long"
  | "insufficient_rights_approvals"
  | "insufficient_rights_budget"
  | "invalid_action_type"
  | "invalid_decision"
  | "link_invalid_or_expired"
  | "magic_link_failed"
  | "message_required"
  | "notifications_load_failed"
  | "oauth_not_configured"
  | "oauth_start_failed"
  | "owner_only_confirm"
  | "owner_only_request"
  | "portal_admin_required"
  | "proposal_not_found_or_decided"
  | "reports_load_failed"
  | "server_error"
  | "services_load_failed"
  | "session_expired"
  | "terms_accept_failed"
  | "token_limit_reached"
  | "token_required"
  | "unsupported_platform"
  | "user_not_found"
  | "verification_failed";

/**
 * Codes waarbij de Hub de tekst zelf per geval samenstelt en al vertaalt
 * (confirmActionRequest krijgt de taal mee). Een vaste zin hier zou juist de
 * reden weggooien, dus voor deze codes wint de servertekst.
 */
const PASSTHROUGH_CODES = new Set<string>(["action_confirm_rejected"]);

/** Error met de code erbij, zodat schermen niet op tekst hoeven te matchen. */
export interface PortalError extends Error {
  code?: string;
}

// Waar de Hub al Nederlands stuurt is de nl-variant letterlijk die tekst. Waar
// de Hub Engels stuurt ("Failed to load approvals", "Not found") staat hier de
// Nederlandse zin die de klant hoort te lezen. De en-variant is voor klanten
// met advisor_language = en.
const ERROR_COPY: Record<PortalErrorCode, { nl: string; en: string }> = {
  // Fouten uit de koppelflow (portalConnect). Alleen server_error is vandaag
  // bereikbaar; de rest zit achter de zelfbedien-vlag die nog uit staat.
  client_without_organization: {
    nl: "Dit account is nog niet aan een organisatie gekoppeld. Je consultant zet dat voor je klaar",
    en: "This account is not linked to an organisation yet. Your consultant will set that up",
  },
  oauth_not_configured: {
    nl: "Dit platform staat nog niet klaar om te koppelen. Je consultant pakt dit op",
    en: "This platform is not ready to connect yet. Your consultant will pick this up",
  },
  oauth_start_failed: {
    nl: "Het koppelen kon niet worden gestart. Probeer het opnieuw",
    en: "We could not start the connection. Please try again",
  },
  portal_admin_required: {
    nl: "Alleen de eigenaar van dit account kan koppelingen wijzigen",
    en: "Only the owner of this account can change integrations",
  },
  server_error: {
    nl: "Er ging iets mis aan onze kant. Probeer het opnieuw",
    en: "Something went wrong on our side. Please try again",
  },
  unsupported_platform: {
    nl: "Dit platform wordt nog niet ondersteund",
    en: "This platform is not supported yet",
  },
  account_load_failed: {
    nl: "Kon je accountgegevens niet laden",
    en: "Could not load your account details",
  },
  account_not_active: {
    nl: "Dit account is niet actief",
    en: "This account is not active",
  },
  action_confirm_failed: {
    nl: "De bevestiging kon niet worden verwerkt",
    en: "The confirmation could not be processed",
  },
  action_request_failed: {
    nl: "De aanvraag kon niet worden verstuurd",
    en: "The request could not be sent",
  },
  action_requests_load_failed: {
    nl: "Kon de aanvragen niet laden",
    en: "Could not load the requests",
  },
  already_decided: {
    nl: "Hier is al over beslist",
    en: "This has already been decided",
  },
  approval_load_failed: {
    nl: "Kon deze goedkeuring niet laden",
    en: "Could not load this approval",
  },
  approval_not_found: {
    nl: "Deze goedkeuring bestaat niet meer",
    en: "This approval no longer exists",
  },
  approvals_load_failed: {
    nl: "Kon de goedkeuringen niet laden",
    en: "Could not load the approvals",
  },
  budget_load_failed: {
    nl: "Kon de budgetvoorstellen niet laden",
    en: "Could not load the budget proposals",
  },
  chat_load_failed: {
    nl: "Kon het gesprek niet laden",
    en: "Could not load the conversation",
  },
  chat_unavailable: {
    nl: "Stevin is even niet bereikbaar. Probeer het zo opnieuw.",
    en: "Stevin is not reachable right now. Please try again shortly.",
  },
  client_not_found: {
    nl: "Client niet gevonden",
    en: "Client not found",
  },
  content_id_required: {
    nl: "Er is geen video gekozen",
    en: "No video was selected",
  },
  creator_archive_load_failed: {
    nl: "Kon het dossier niet laden",
    en: "Could not load the track record",
  },
  creator_audience_load_failed: {
    nl: "Kon het publiek niet laden",
    en: "Could not load the audience",
  },
  creator_decisions_load_failed: {
    nl: "Kon de besluiten niet laden",
    en: "Could not load the decisions",
  },
  creator_retention_load_failed: {
    nl: "Kon de retentie niet laden",
    en: "Could not load the retention",
  },
  creator_signals_load_failed: {
    nl: "Kon de meldingen van je kanaal niet laden",
    en: "Could not load your channel alerts",
  },
  creator_summary_load_failed: {
    nl: "Kon het creator-overzicht niet laden",
    en: "Could not load the creator overview",
  },
  creator_traffic_load_failed: {
    nl: "Kon de verkeersbronnen niet laden",
    en: "Could not load the traffic sources",
  },
  creator_videos_load_failed: {
    nl: "Kon de video's niet laden",
    en: "Could not load the videos",
  },
  dashboard_load_failed: {
    nl: "Kon het overzicht niet laden",
    en: "Could not load the overview",
  },
  decision_failed: {
    nl: "De beslissing kon niet worden verwerkt",
    en: "The decision could not be processed",
  },
  email_required: {
    nl: "Vul je e-mailadres in",
    en: "Please enter your email address",
  },
  feedback_failed: {
    nl: "Je feedback kon niet worden opgeslagen",
    en: "Your feedback could not be saved",
  },
  feedback_message_required: {
    nl: "Vul een bericht in",
    en: "Please enter a message",
  },
  invalid_decision: {
    nl: "Ongeldige keuze",
    en: "Invalid choice",
  },
  link_invalid_or_expired: {
    nl: "Deze link is verlopen of niet geldig",
    en: "This link has expired or is not valid",
  },
  magic_link_failed: {
    nl: "De inloglink kon niet worden verstuurd. Probeer het opnieuw.",
    en: "The login link could not be sent. Please try again.",
  },
  message_required: {
    nl: "Vul een bericht in, maximaal 2000 tekens",
    en: "Please enter a message, 2000 characters at most",
  },
  notifications_load_failed: {
    nl: "Kon de meldingen niet laden",
    en: "Could not load the notifications",
  },
  proposal_not_found_or_decided: {
    nl: "Dit voorstel bestaat niet meer of is al beslist",
    en: "This proposal no longer exists or has already been decided",
  },
  reports_load_failed: {
    nl: "Kon de rapportages niet laden",
    en: "Could not load the reports",
  },
  services_load_failed: {
    nl: "Kon de diensten niet laden",
    en: "Could not load the services",
  },
  terms_accept_failed: {
    nl: "De voorwaarden konden niet worden vastgelegd",
    en: "The terms could not be recorded",
  },
  token_required: {
    nl: "Geen geldige link",
    en: "This link is not valid",
  },
  user_not_found: {
    nl: "Dit account is niet gevonden",
    en: "This account was not found",
  },
  verification_failed: {
    nl: "Inloggen is niet gelukt. Probeer het opnieuw.",
    en: "Signing in did not work. Please try again.",
  },
  brain_load_failed: {
    nl: "Kon het geheugen niet laden",
    en: "Could not load the memory",
  },
  insufficient_rights_approvals: {
    nl: "Onvoldoende rechten, alleen medewerkers en admins kunnen goedkeuren",
    en: "Insufficient rights, only staff and admins can approve",
  },
  insufficient_rights_budget: {
    nl: "Onvoldoende rechten, alleen medewerkers en admins kunnen budgetten goedkeuren",
    en: "Insufficient rights, only staff and admins can approve budgets",
  },
  feedback_too_long: {
    nl: "Feedback max 1000 tekens",
    en: "Feedback is limited to 1000 characters",
  },
  feedback_required: {
    nl: "Feedback is verplicht bij afkeuren of revisie",
    en: "Feedback is required when rejecting or asking for a revision",
  },
  owner_only_request: {
    nl: "Alleen de eigenaar (admin) kan campagnewijzigingen aanvragen. Neem contact op met de accountbeheerder.",
    en: "Only the owner (admin) can request campaign changes. Please contact the account administrator.",
  },
  invalid_action_type: {
    nl: "Ongeldig actietype",
    en: "Invalid action type",
  },
  owner_only_confirm: {
    nl: "Alleen de eigenaar kan dit bevestigen",
    en: "Only the owner can confirm this",
  },
  token_limit_reached: {
    nl: "Tokenlimiet bereikt",
    en: "Token limit reached",
  },
  session_expired: {
    nl: "Sessie verlopen. Log opnieuw in.",
    en: "Session expired. Please log in again.",
  },
};

/** Zin voor een code die dit portaal nog niet kent. */
const GENERIC_ERROR = {
  nl: "Er ging iets mis, probeer het opnieuw.",
  en: "Something went wrong, please try again.",
};

/** Vertaalde tekst bij een bekende code, anders null. */
function translateCode(code: string, lang: Lang): string | null {
  const copy = ERROR_COPY[code as PortalErrorCode];
  return copy ? pick(lang, copy) : null;
}

/**
 * De tekst die de klant te zien krijgt. Zie de kop van dit bestand voor de
 * volgorde: bekende code, dan onbekende code, dan geen code.
 */
function errorMessage(
  code: string | undefined,
  serverMessage: string | null,
  status: number,
  lang: Lang,
): string {
  if (!code) {
    return (
      serverMessage ??
      pick(lang, { nl: `Fout: ${status}`, en: `Error: ${status}` })
    );
  }
  if (PASSTHROUGH_CODES.has(code)) {
    return serverMessage ?? pick(lang, GENERIC_ERROR);
  }
  return translateCode(code, lang) ?? pick(lang, GENERIC_ERROR);
}

function portalError(message: string, code?: string): PortalError {
  const err: PortalError = new Error(message);
  if (code) err.code = code;
  return err;
}

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
    throw portalError(pick(lang, ERROR_COPY.session_expired), "session_expired");
  }

  if (!res.ok) {
    let serverMessage: string | null = null;
    let code: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.errorCode === "string" && body.errorCode) code = body.errorCode;
      if (typeof body?.error === "string" && body.error) serverMessage = body.error;
    } catch {}

    throw portalError(errorMessage(code, serverMessage, res.status, lang), code);
  }

  return res.json();
}
