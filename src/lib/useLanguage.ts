"use client";

/**
 * Taal van de klantschermen.
 *
 * Bron is clients.advisor_language (migratie 171), geleverd door
 * /api/portal/me. Bewust geen i18n-bibliotheek: elk scherm houdt zijn eigen
 * COPY-object met een nl- en een en-variant, zoals TrackRecord dat al doet.
 * Dat leest beter dan losse sleutels en voorkomt half vertaalde schermen.
 *
 * Het antwoord wordt op moduleniveau bewaard zodat elk scherm dezelfde taal
 * gebruikt zonder /me opnieuw op te halen; bij een mislukte call blijft het
 * Nederlands, want dat is wat vrijwel elke klant vandaag krijgt.
 */

import { useEffect, useState } from "react";
import { portalFetch } from "./api";

export type Lang = "nl" | "en";

let cached: Lang | null = null;
let inFlight: Promise<Lang> | null = null;

async function fetchLanguage(): Promise<Lang> {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = portalFetch<{ language?: string }>("/me")
      .then((me) => {
        cached = me.language === "en" ? "en" : "nl";
        return cached;
      })
      .catch(() => {
        cached = "nl";
        return cached;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Taal van de ingelogde klant. Start op de gecachte waarde of nl. */
export function useLanguage(): Lang {
  const [lang, setLang] = useState<Lang>(cached ?? "nl");

  useEffect(() => {
    let active = true;
    fetchLanguage().then((value) => {
      if (active) setLang(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return lang;
}

/**
 * Taal buiten React om, voor code die geen hook mag aanroepen (zoals de
 * API-client). Geeft de gecachte waarde terug zodra /me is opgehaald, en
 * daarvoor Nederlands.
 */
export function currentLang(): Lang {
  return cached ?? "nl";
}

/** Kiest de juiste variant uit een tweetalig copy-object. */
export function pick<T>(lang: Lang, copy: { nl: T; en: T }): T {
  return copy[lang];
}

/** Locale voor datum- en getalnotatie. */
export function localeFor(lang: Lang): string {
  return lang === "en" ? "en-GB" : "nl-NL";
}
