/**
 * Datums in woorden voor de klant (W-124, 13 sep 2026). De Hub levert
 * ISO-datums (2026-09-12) als machineformaat; op het scherm en in de PDF hoort
 * "12 september 2026" te staan. Zelfde regels als getalFormat.ts in de Hub.
 */
import type { Lang } from "@/lib/useLanguage";

const MAANDEN: Record<Lang, string[]> = {
  nl: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

export function fmtDatum(iso: string | null | undefined, lang: Lang, metJaar = true): string {
  if (!iso) return lang === "en" ? "unknown" : "onbekend";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const dag = Number(m[3]);
  const maand = MAANDEN[lang][Number(m[2]) - 1] ?? m[2];
  return metJaar ? `${dag} ${maand} ${m[1]}` : `${dag} ${maand}`;
}

/** "14 augustus t/m 12 september 2026"; bij twee jaartallen staat het jaar bij allebei. */
export function fmtPeriode(van: string, tot: string, lang: Lang): string {
  const zelfdeJaar = van.slice(0, 4) === tot.slice(0, 4);
  const tm = lang === "en" ? "to" : "t/m";
  return `${fmtDatum(van, lang, !zelfdeJaar)} ${tm} ${fmtDatum(tot, lang)}`;
}
