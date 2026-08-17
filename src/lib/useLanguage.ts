"use client";

/**
 * Taal van de klantschermen.
 *
 * Bron is clients.advisor_language (migratie 171), geleverd door
 * /api/portal/me. Bewust geen i18n-bibliotheek: elk scherm houdt zijn eigen
 * COPY-object met een nl- en een en-variant, zoals TrackRecord dat al doet.
 * Dat leest beter dan losse sleutels en voorkomt half vertaalde schermen.
 *
 * Het antwoord wordt bewaard in sessionStorage en gespiegeld in een
 * module-variabele. Daardoor staat de taal bij elke volgende pageload meteen
 * goed, zonder op /me te wachten: een Engelse klant zag anders bij iedere
 * refresh eerst het Nederlandse scherm voorbijkomen (17 augustus 2026).
 *
 * Alleen de allereerste pageload van een sessie kent de taal echt niet. Dan
 * geeft useLanguageReady() false terug en houdt het scherm zijn eigen
 * laadtoestand aan, tot /me heeft geantwoord. Een rondje op het scherm heeft
 * geen taal, een zin wel.
 *
 * sessionStorage is de baas over wat er bewaard is: haalt clearAuth of
 * setAuth in auth.ts de sleutel weg (uitloggen, of een andere klant die in
 * ditzelfde tabblad inlogt), dan vervalt ook de module-cache en vraagt het
 * volgende scherm opnieuw aan /me.
 */

import { useEffect, useSyncExternalStore } from "react";
import { portalFetch } from "./api";
import { LANG_KEY } from "./auth";

export type Lang = "nl" | "en";

/** Taal zoals we hem nu kennen. null betekent: nog onbekend. */
let known: Lang | null = null;
/** Wat er in sessionStorage stond toen `known` werd gezet. */
let mirrored: Lang | null = null;
/** /me heeft geantwoord in deze pageload, ook als die call misging. */
let answered = false;
let inFlight: Promise<void> | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

function readStored(): Lang | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LANG_KEY);
    return raw === "nl" || raw === "en" ? raw : null;
  } catch {
    // Private mode of geblokkeerde opslag: dan valt het terug op /me per
    // pageload, precies zoals het hiervoor werkte.
    return null;
  }
}

/**
 * Leest sessionStorage en houdt de module-cache daarmee gelijk. Loopt het
 * uiteen, dan is de sessie gewisseld (in- of uitgelogd) en beginnen we
 * opnieuw. Geeft de bekende taal terug, of null als die nog onbekend is.
 */
function syncWithSession(): Lang | null {
  const stored = readStored();
  if (stored !== mirrored) {
    mirrored = stored;
    known = stored;
    answered = stored != null;
    inFlight = null;
  }
  return known;
}

function fetchLanguage(): void {
  if (known || inFlight) return;
  inFlight = portalFetch<{ language?: string }>("/me")
    .then((me) => {
      const value: Lang = me.language === "en" ? "en" : "nl";
      known = value;
      mirrored = value;
      answered = true;
      try {
        window.sessionStorage.setItem(LANG_KEY, value);
      } catch {
        // Niet kunnen bewaren is geen fout, alleen geen snelheidswinst.
      }
    })
    .catch(() => {
      // Taal blijft onbekend. `answered` gaat wel aan zodat schermen niet
      // eeuwig op de spinner blijven staan; ze krijgen dan Nederlands, want
      // dat is wat vrijwel elke klant vandaag krijgt. `known` blijft leeg,
      // dus een volgend scherm probeert het gewoon opnieuw.
      answered = true;
    })
    .finally(() => {
      inFlight = null;
      notify();
    });
}

// useSyncExternalStore in plaats van useState: de dashboard-layout wordt
// server-side voorgerenderd en kent sessionStorage niet. Met een aparte
// server-snapshot rendert React de hydratie met "nog onbekend" en schakelt
// daarna meteen om, zonder hydratie-fout. Schermen achter AuthGuard mounten
// pas na de hydratie en krijgen de bewaarde taal dus bij hun eerste render.
function langSnapshot(): Lang | null {
  return syncWithSession();
}

function langServerSnapshot(): Lang | null {
  return null;
}

function readySnapshot(): boolean {
  return syncWithSession() != null || answered;
}

function readyServerSnapshot(): boolean {
  return false;
}

/** Taal van de ingelogde klant. Zolang die onbekend is: nl. */
export function useLanguage(): Lang {
  useEffect(() => {
    fetchLanguage();
  }, []);
  return useSyncExternalStore(subscribe, langSnapshot, langServerSnapshot) ?? "nl";
}

/**
 * Staat de taal al vast? Schermen houden hun eigen laadtoestand aan zolang dit
 * false is. Zonder die stap toont de eerste pageload van een sessie eerst
 * Nederlandse tekst, ook bij een Engelse klant.
 */
export function useLanguageReady(): boolean {
  useEffect(() => {
    fetchLanguage();
  }, []);
  return useSyncExternalStore(subscribe, readySnapshot, readyServerSnapshot);
}

/**
 * Taal buiten React om, voor code die geen hook mag aanroepen (zoals de
 * API-client). Geeft de bewaarde of opgehaalde waarde terug, en daarvoor
 * Nederlands.
 */
export function currentLang(): Lang {
  return syncWithSession() ?? "nl";
}

/** Kiest de juiste variant uit een tweetalig copy-object. */
export function pick<T>(lang: Lang, copy: { nl: T; en: T }): T {
  return copy[lang];
}

/** Locale voor datum- en getalnotatie. */
export function localeFor(lang: Lang): string {
  return lang === "en" ? "en-GB" : "nl-NL";
}
