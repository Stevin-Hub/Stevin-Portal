"use client";

import type { Lang } from "@/lib/useLanguage";

/**
 * Resultaten per maand, dit jaar naast hetzelfde maand vorig jaar.
 *
 * Bewust met de hand getekende SVG en geen grafiekbibliotheek: het is een simpele
 * reeks, en zo is het beeld in de PDF hetzelfde als op het scherm. Alles wat je
 * ziet, inclusief de legenda, staat IN de SVG. Buiten de SVG zou het bij de
 * export wegvallen, want de printweergave heeft de opmaak van de app niet.
 *
 * De cijfers komen uit /chat/series, dezelfde bron als de tekst van Stevin, dus
 * een staaf kan nooit iets anders zeggen dan het antwoord. Geen modelaanroep,
 * dus nul extra tokens.
 */
export interface MonthPoint {
  key: string;
  label: string;
  conversions: number;
  cost: number;
  cpa: number | null;
}

const COPY = {
  nl: { titel: "Resultaten per maand", ditJaar: "dit jaar", vorigJaar: "zelfde maand vorig jaar", leeg: "Nog geen maandcijfers." },
  en: { titel: "Results per month", ditJaar: "this year", vorigJaar: "same month last year", leeg: "No monthly data yet." },
} as const;

export default function MetricsChart({
  months,
  lang,
  maanden = 12,
}: {
  months: MonthPoint[];
  lang: Lang;
  maanden?: number;
}) {
  const t = COPY[lang];
  const opKey = new Map(months.map((m) => [m.key, m]));

  // Een klant die net begonnen is heeft geen vorig jaar. Dan geen lege lichte
  // staven en geen legenda die naar niets verwijst: gewoon de maanden die er zijn.
  const eersteMetData = months.findIndex((m) => m.conversions > 0 || m.cost > 0);
  const gevuld = eersteMetData === -1 ? months : months.slice(eersteMetData);
  const data = gevuld.slice(-maanden).map((m) => {
    const [jaar, maand] = m.key.split("-");
    const vorig = opKey.get(`${Number(jaar) - 1}-${maand}`);
    return { ...m, vorigJaar: vorig && (vorig.conversions > 0 || vorig.cost > 0) ? vorig.conversions : null };
  });
  if (data.length === 0) return <p className="text-xs text-muted-foreground">{t.leeg}</p>;
  const toonVorigJaar = data.some((d) => d.vorigJaar !== null);

  const W = 640;
  const H = 210;
  const padL = 8;
  const padR = 8;
  const padT = 30;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...data.flatMap((d) => [d.conversions, d.vorigJaar ?? 0]), 1);
  const stapX = innerW / data.length;
  const paarB = Math.min(34, stapX * 0.62);
  const staafB = toonVorigJaar ? paarB / 2 - 1 : paarB;

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t.titel}>
        <text x={padL} y={12} fontSize="11" fontWeight="600" fill="#1f2933">
          {t.titel}
        </text>
        {/* Legenda in de SVG, zodat hij de export naar PDF overleeft. */}
        {toonVorigJaar && (
          <>
            <rect x={padL} y={20} width={9} height={9} rx={2} fill="#3c8eff" />
            <text x={padL + 14} y={28} fontSize="9" fill="#64748b">
              {t.ditJaar}
            </text>
            <rect x={padL + 14 + t.ditJaar.length * 4.6 + 12} y={20} width={9} height={9} rx={2} fill="#c7d9f7" />
            <text x={padL + 14 + t.ditJaar.length * 4.6 + 26} y={28} fontSize="9" fill="#64748b">
              {t.vorigJaar}
            </text>
          </>
        )}

        {data.map((d, i) => {
          const midden = padL + i * stapX + stapX / 2;
          const hNu = (d.conversions / max) * innerH;
          const hVorig = d.vorigJaar !== null ? (d.vorigJaar / max) * innerH : 0;
          const xVorig = midden - staafB - 1;
          const xNu = toonVorigJaar ? midden + 1 : midden - staafB / 2;
          return (
            <g key={d.key}>
              {d.vorigJaar !== null && (
                <rect x={xVorig} y={padT + innerH - hVorig} width={staafB} height={Math.max(hVorig, 1)} rx={2} fill="#c7d9f7" />
              )}
              <rect x={xNu} y={padT + innerH - hNu} width={staafB} height={Math.max(hNu, 1)} rx={2} fill="#3c8eff" />
              {d.conversions > 0 && (
                <text x={xNu + staafB / 2} y={padT + innerH - hNu - 4} textAnchor="middle" fontSize="8.5" fill="#64748b">
                  {d.conversions}
                </text>
              )}
              <text x={midden} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {d.label}
              </text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#d6dde8" strokeWidth="1" />
      </svg>
    </div>
  );
}
