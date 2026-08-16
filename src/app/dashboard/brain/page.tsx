"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import BrainConstellation from "./BrainConstellation";
import TrackRecord, { type ArchiveLang } from "./TrackRecord";
import { portalFetch } from "@/lib/api";
import { useBrainData, type BrainHealth, type BrainNodeType, type HealthStatus } from "./useBrainData";

const TYPE_COLORS: Record<BrainNodeType, string> = {
  campagne: "#3c8eff",
  creatie: "#14a3a3",
  outcome: "#2f9e6e",
  kennis: "#b7791f",
};

const LEGEND_ORDER: BrainNodeType[] = ["campagne", "creatie", "outcome", "kennis"];

interface PageCopy {
  eyebrow: string;
  title: string;
  intro: string;
  tabRecord: string;
  tabMap: string;
  legend: Record<BrainNodeType, string>;
  dragHint: string;
  updatedPrefix: string;
  status: Record<HealthStatus, string>;
  syncPrefix: string;
  emptyTitle: string;
  emptyBody: string;
}

// Twee talen omdat het dossier ook aan Engelstalige klanten wordt getoond
// (advisor_language uit /me). Niet-creator-klanten zien altijd de
// Nederlandse pagina, precies zoals hij was.
const PAGE_COPY: Record<ArchiveLang, PageCopy> = {
  nl: {
    eyebrow: "Geheugen",
    title: "Stevin Brain",
    intro: "Het geheugen van jullie marketing: wat is gedaan, wat werkte, wat we onthouden.",
    tabRecord: "Dossier",
    tabMap: "Kaart",
    legend: { campagne: "Campagnes", creatie: "Creaties", outcome: "Resultaten", kennis: "Kennis" },
    dragHint: "Sleep een punt om het te verplaatsen, scroll om te zoomen, tik een punt aan voor de details.",
    updatedPrefix: "Bijgewerkt:",
    status: { fresh: "vers", stale: "verouderd", missing: "ontbreekt" },
    syncPrefix: "Laatste sync:",
    emptyTitle: "Het geheugen wordt opgebouwd",
    emptyBody: "Stevin bouwt het geheugen op, zodra er campagnes en resultaten zijn verschijnt hier de kaart.",
  },
  en: {
    eyebrow: "Memory",
    title: "Stevin Brain",
    intro: "The memory of your marketing: what was done, what worked, what we remember.",
    tabRecord: "Track record",
    tabMap: "Map",
    legend: { campagne: "Campaigns", creatie: "Creatives", outcome: "Results", kennis: "Knowledge" },
    dragHint: "Drag a point to move it, scroll to zoom, tap a point for the details.",
    updatedPrefix: "Updated:",
    status: { fresh: "fresh", stale: "stale", missing: "missing" },
    syncPrefix: "Last sync:",
    emptyTitle: "The memory is being built",
    emptyBody: "Stevin is building the memory; as soon as there are campaigns and results, the map appears here.",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  google_ads: "Google Ads",
  google_ads_sheet: "Google Ads",
  meta_ads: "Meta",
  ga4: "analytics",
  search_console: "Search Console",
  sheets: "sheets",
  mail: "mail",
  reddit: "reddit",
  campaigns: "campagnes",
  campagnes: "campagnes",
  creatives: "creatives",
  creaties: "creatives",
  outcomes: "resultaten",
  resultaten: "resultaten",
  knowledge: "kennis",
  kennis: "kennis",
};

// Een Engelstalige klant las "campagnes fresh, kennis fresh" onder een
// legenda die "Campaigns" en "Knowledge" zegt (review 17 aug). Alleen de
// bronnen die de klantprojectie doorlaat hoeven een vertaling.
const SOURCE_LABELS_EN: Record<string, string> = {
  campaigns: "campaigns",
  campagnes: "campaigns",
  creatives: "creatives",
  creaties: "creatives",
  briefings: "briefings",
  outcomes: "results",
  resultaten: "results",
  knowledge: "knowledge",
  kennis: "knowledge",
  ga4: "analytics",
  sheets: "sheets",
  mail: "mail",
};

function sourceLabel(source: string, lang: "nl" | "en" = "nl"): string {
  if (lang === "en") {
    return SOURCE_LABELS_EN[source] ?? SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
  }
  return sourceLabelNl(source);
}

function sourceLabelNl(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

function syncTitle(item: BrainHealth, copy: PageCopy, locale: string): string | undefined {
  if (!item.last_sync) return undefined;
  const d = new Date(item.last_sync);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${copy.syncPrefix} ${d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

export default function BrainPage() {
  return <AuthGuard>{() => <BrainContent />}</AuthGuard>;
}

interface MeResponse {
  creator?: boolean;
  language?: string;
}

function BrainContent() {
  const { data, loading, error } = useBrainData();
  const [me, setMe] = useState<{ creator: boolean; language: ArchiveLang } | null>(null);
  const [view, setView] = useState<"record" | "map">("record");

  useEffect(() => {
    let active = true;
    portalFetch<MeResponse>("/me")
      .then((res) => {
        if (!active) return;
        setMe({ creator: Boolean(res.creator), language: res.language === "en" ? "en" : "nl" });
      })
      .catch(() => {
        if (active) setMe({ creator: false, language: "nl" });
      });
    return () => {
      active = false;
    };
  }, []);

  // Het dossier bestaat alleen voor creator-klanten. Zolang /me niet binnen
  // is tonen we niets, anders flitst de kaart even voor het dossier langs.
  const isCreator = me?.creator === true;
  const language: ArchiveLang = me?.creator && me.language === "en" ? "en" : "nl";
  const copy = PAGE_COPY[language];
  const locale = language === "en" ? "en-GB" : "nl-NL";
  const showRecord = isCreator && view === "record";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{copy.eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-foreground">{copy.title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-snug text-muted-foreground">{copy.intro}</p>
      </header>

      {isCreator && (
        <div className="inline-flex rounded-2xl border border-border bg-card p-1">
          {([
            { key: "record" as const, label: copy.tabRecord },
            { key: "map" as const, label: copy.tabMap },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              aria-pressed={view === tab.key}
              className={`rounded-xl px-3.5 py-1.5 text-[13px] font-bold transition ${
                view === tab.key ? "bg-accent-light text-accent" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {me === null ? (
        <div className="grid min-h-[52vh] place-items-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : showRecord ? (
        <TrackRecord language={language} />
      ) : loading ? (
        <div className="grid min-h-[52vh] place-items-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : !data || data.density.gate === "none" ? (
        <EmptyState error={error} copy={copy} />
      ) : (
        <section className="rounded-2xl border border-border bg-card px-4 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)] sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGEND_ORDER.map((type) => (
              <span key={type} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                {copy.legend[type]}
              </span>
            ))}
          </div>

          <div className="rounded-xl border border-border-subtle bg-[#fbfcfe]">
            <BrainConstellation nodes={data.nodes} edges={data.edges} />
          </div>

          <p className="mt-3 text-[12px] leading-snug text-muted-foreground">{copy.dragHint}</p>

          {data.health.length > 0 && <HealthLine health={data.health} copy={copy} locale={locale} lang={language} />}
        </section>
      )}
    </div>
  );
}

function HealthLine({ health, copy, locale, lang }: { health: BrainHealth[]; copy: PageCopy; locale: string; lang: "nl" | "en" }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-t border-border-subtle pt-3 text-[12px] text-muted-foreground">
      <span className="font-semibold text-foreground">{copy.updatedPrefix}</span>
      {health.map((item, idx) => {
        const label = sourceLabel(item.source, lang);
        const word = copy.status[item.status];
        const title = syncTitle(item, copy, locale);
        const isLast = idx === health.length - 1;
        if (item.status === "fresh") {
          return (
            <span key={`${item.source}-${idx}`} title={title}>
              {label} {word}
              {isLast ? "" : ","}
            </span>
          );
        }
        // stale/missing: outline-badge in gewone ink, niet rood.
        return (
          <span
            key={`${item.source}-${idx}`}
            title={title}
            className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground"
          >
            {label} {word}
          </span>
        );
      })}
    </p>
  );
}

function EmptyState({ error, copy }: { error: string | null; copy: PageCopy }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-light">
        <span className="h-3 w-3 rounded-full bg-accent" />
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-[-0.01em] text-foreground">{copy.emptyTitle}</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-snug text-muted-foreground">{copy.emptyBody}</p>
      {error && <p className="mx-auto mt-3 max-w-md text-[12px] text-muted-foreground">{error}</p>}
    </section>
  );
}
