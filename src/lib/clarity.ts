/**
 * Microsoft Clarity in het klantportaal (W-128, 14 september 2026).
 *
 * De regel van Koen: de portal wordt NOOIT opgenomen zonder geldige
 * toestemming. Clarity's eigen Consent Mode regelt alleen cookies; zonder
 * toestemming neemt het script nog steeds op, met een id per paginaweergave.
 * Daarom laden we het script pas NADAT de klant zijn toestemming in het
 * register heeft vastgelegd (analytics_consent, vrijwillig vinkje in de
 * clickwrap), en nooit bij meekijken door een consultant.
 *
 * Bron van de aanroepen: learn.microsoft.com/en-us/clarity, Consent API v2
 * (window.clarity('consentv2', {ad_Storage, analytics_Storage})) en het
 * standaardscript op https://www.clarity.ms/tag/<project>. Gelezen op 14 sep.
 */

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

const SCRIPT_ID = "stevin-clarity";

/** Het project-ID komt uit de omgeving; zonder ID gebeurt er niets. */
export function clarityProjectId(): string | null {
  const id = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  return id && /^[a-z0-9]{6,20}$/i.test(id) ? id : null;
}

/**
 * Laadt het script een keer. Geeft true als het (al) geladen is. Doet niets
 * op de server of zonder project-ID.
 */
export function startClarity(projectId: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (document.getElementById(SCRIPT_ID)) return true;
  // Zelfde wachtrij als het officiele fragment: aanroepen voor het laden
  // worden bewaard en daarna afgespeeld.
  if (!window.clarity) {
    const wachtrij: ClarityFn = ((...args: unknown[]) => {
      (wachtrij.q = wachtrij.q || []).push(args);
    }) as ClarityFn;
    window.clarity = wachtrij;
  }
  const s = document.createElement("script");
  s.id = SCRIPT_ID;
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${projectId}`;
  document.head.appendChild(s);
  return true;
}

/** Toestemming doorgeven: analyse ja, advertenties nooit (wij adverteren niet in het portaal). */
export function grantClarityConsent(): void {
  window.clarity?.("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
}

/**
 * Intrekken: Clarity wist zijn cookies en stopt de sessie. Het script zelf
 * blijft tot de volgende paginalading staan; daarna wordt het niet meer
 * geladen, want de stand in het register is dan "ingetrokken".
 */
export function withdrawClarityConsent(): void {
  window.clarity?.("consent", false);
}

export function clarityIsGeladen(): boolean {
  return typeof document !== "undefined" && !!document.getElementById(SCRIPT_ID);
}
