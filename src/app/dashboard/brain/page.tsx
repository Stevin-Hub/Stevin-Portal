"use client";

import AuthGuard from "@/components/AuthGuard";
import BrainConstellation from "./BrainConstellation";
import { useBrainData, type BrainHealth, type BrainNodeType, type HealthStatus } from "./useBrainData";

const TYPE_COLORS: Record<BrainNodeType, string> = {
  campagne: "#3c8eff",
  creatie: "#14a3a3",
  outcome: "#2f9e6e",
  kennis: "#b7791f",
};

const LEGEND: Array<{ type: BrainNodeType; label: string }> = [
  { type: "campagne", label: "Campagnes" },
  { type: "creatie", label: "Creaties" },
  { type: "outcome", label: "Resultaten" },
  { type: "kennis", label: "Kennis" },
];

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

const STATUS_WORD: Record<HealthStatus, string> = {
  fresh: "vers",
  stale: "verouderd",
  missing: "ontbreekt",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

function syncTitle(item: BrainHealth): string | undefined {
  if (!item.last_sync) return undefined;
  const d = new Date(item.last_sync);
  if (Number.isNaN(d.getTime())) return undefined;
  return `Laatste sync: ${d.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
}

export default function BrainPage() {
  return <AuthGuard>{() => <BrainContent />}</AuthGuard>;
}

function BrainContent() {
  const { data, loading, error } = useBrainData();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Geheugen</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-foreground">Stevin Brain</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-snug text-muted-foreground">
          Het geheugen van jullie marketing: wat is gedaan, wat werkte, wat we onthouden.
        </p>
      </header>

      {loading ? (
        <div className="grid min-h-[52vh] place-items-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : !data || data.density.gate === "none" ? (
        <EmptyState error={error} />
      ) : (
        <section className="rounded-2xl border border-border bg-card px-4 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)] sm:px-6">
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            {LEGEND.map((item) => (
              <span key={item.type} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[item.type] }} />
                {item.label}
              </span>
            ))}
          </div>

          <div className="rounded-xl border border-border-subtle bg-[#fbfcfe]">
            <BrainConstellation nodes={data.nodes} edges={data.edges} />
          </div>

          <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
            Sleep een punt om het te verplaatsen, scroll om te zoomen, tik een punt aan voor de details.
          </p>

          {data.health.length > 0 && <HealthLine health={data.health} />}
        </section>
      )}
    </div>
  );
}

function HealthLine({ health }: { health: BrainHealth[] }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 border-t border-border-subtle pt-3 text-[12px] text-muted-foreground">
      <span className="font-semibold text-foreground">Bijgewerkt:</span>
      {health.map((item, idx) => {
        const label = sourceLabel(item.source);
        const word = STATUS_WORD[item.status];
        const title = syncTitle(item);
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

function EmptyState({ error }: { error: string | null }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-accent-light">
        <span className="h-3 w-3 rounded-full bg-accent" />
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-[-0.01em] text-foreground">Het geheugen wordt opgebouwd</h2>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-snug text-muted-foreground">
        Stevin bouwt het geheugen op, zodra er campagnes en resultaten zijn verschijnt hier de kaart.
      </p>
      {error && <p className="mx-auto mt-3 max-w-md text-[12px] text-muted-foreground">{error}</p>}
    </section>
  );
}
