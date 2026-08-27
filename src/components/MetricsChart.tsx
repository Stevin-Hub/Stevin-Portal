"use client";

import type { Lang } from "@/lib/useLanguage";

/**
 * Resultaten per maand als staafjes, met de kosten per resultaat als lijn.
 *
 * Bewust met de hand getekende SVG en geen grafiekbibliotheek: het is een
 * simpele reeks, en zo blijft de export naar PDF hetzelfde beeld als op het
 * scherm. De cijfers komen uit /chat/series, dezelfde bron als de tekst van
 * Stevin, dus een staafje kan nooit iets anders zeggen dan het antwoord.
 * Er komt geen model aan te pas: nul tokens.
 */
export interface MonthPoint {
  key: string;
  label: string;
  conversions: number;
  cost: number;
  cpa: number | null;
}

const COPY = {
  nl: { titel: "Resultaten per maand", resultaten: "resultaten", cpa: "kosten per resultaat", leeg: "Nog geen maandcijfers." },
  en: { titel: "Results per month", resultaten: "results", cpa: "cost per result", leeg: "No monthly data yet." },
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
  const data = months.slice(-maanden);
  if (data.length === 0) return <p className="text-xs text-muted-foreground">{t.leeg}</p>;

  const W = 640;
  const H = 200;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxConv = Math.max(...data.map((d) => d.conversions), 1);
  const cpas = data.map((d) => d.cpa).filter((c): c is number => c !== null && c > 0);
  const maxCpa = cpas.length > 0 ? Math.max(...cpas) : 0;

  const stapX = innerW / data.length;
  const staafB = Math.min(38, stapX * 0.6);

  const lijn = data
    .map((d, i) => {
      if (d.cpa === null || maxCpa === 0) return null;
      const x = padL + i * stapX + stapX / 2;
      const y = padT + innerH - (d.cpa / maxCpa) * innerH * 0.9;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground mb-1">{t.titel}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t.titel}>
        {data.map((d, i) => {
          const h = (d.conversions / maxConv) * innerH;
          const x = padL + i * stapX + (stapX - staafB) / 2;
          const y = padT + innerH - h;
          return (
            <g key={d.key}>
              <rect x={x} y={y} width={staafB} height={Math.max(h, 1)} rx={3} fill="#3c8eff" opacity={0.85} />
              {d.conversions > 0 && (
                <text x={x + staafB / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#64748b">
                  {d.conversions}
                </text>
              )}
              <text x={padL + i * stapX + stapX / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {d.label}
              </text>
            </g>
          );
        })}
        {lijn && <polyline points={lijn} fill="none" stroke="#1f9d55" strokeWidth="1.5" />}
      </svg>
      <p className="text-[11px] text-muted-foreground mt-1">
        <span className="inline-block w-2 h-2 rounded-sm align-middle mr-1" style={{ background: "#3c8eff" }} />
        {t.resultaten}
        <span className="inline-block w-3 h-0.5 align-middle ml-3 mr-1" style={{ background: "#1f9d55" }} />
        {t.cpa}
      </p>
    </div>
  );
}
