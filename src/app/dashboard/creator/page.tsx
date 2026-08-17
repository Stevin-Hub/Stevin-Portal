"use client";

/**
 * /dashboard/creator, Casey's channel dashboard (D-021).
 *
 * Same data, same math as the internal Desk screen: everything comes from
 * the shared insights layer in the Hub (/api/portal/creator/*), client
 * scope hard-locked in the portal token. Reading order mirrors the plan:
 * what's worth knowing, the four numbers deals are priced on, then every
 * video against your own normal. Shorts and long-form are never summed:
 * since 31 March 2025 a Shorts view counts every start or replay and is a
 * different unit than a long-form view.
 *
 * Bilingual since 17 August 2026, same pattern as the other client screens:
 * one COPY object per language, language from clients.advisor_language via
 * useLanguage(), dates and numbers through localeFor(lang). The trade terms
 * (Shorts, long-form, multiplier) stay identical in both languages, only the
 * explanations are translated.
 */

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { portalFetch } from "@/lib/api";
import { useLanguage, useLanguageReady, localeFor, type Lang } from "@/lib/useLanguage";

interface SyncMeta {
  last_sync_at: string | null;
  fresh: boolean;
}

interface Summary {
  days: number;
  kpis: { subscribers: number | null; net_subscriber_change: number; uploads: number; views: number };
  sync: SyncMeta;
}

interface VideoRow {
  content_id: string;
  content_type: string;
  title: string | null;
  thumbnail_url: string | null;
  length_class: string | null;
  published_at: string | null;
  age_days: number;
  views: number | null;
  views_multiplier: number | null;
  avg_view_percentage: number | null;
  retention_vs_median: number | null;
  subscribers_gained: number | null;
  subs_per_1000_views: number | null;
}

interface FormatMedians {
  median_lifetime_views_30_90d: number | null;
  sample_30_90d: number;
  subs_per_1000_views_90d: number | null;
}

interface VideosResponse {
  min_class_sample: number;
  medians: Record<string, FormatMedians>;
  videos: VideoRow[];
}

interface SignalItem {
  id: string;
  headline: string | null;
  title: string;
  summary: string | null;
  url: string | null;
  priority: string;
  created_at_source: string;
}

interface RetentionResponse {
  measured_on: string | null;
  measured_dates: string[];
  curve: Array<{ bucket_ratio: number; audience_watch_ratio: number | null }>;
}

interface Copy {
  loading: string;
  title: string;
  intro: string;
  syncFresh: string;
  syncStale: string;
  signalsTitle: string;
  signalsEmpty: string;
  tileMedianLong: string;
  tileMedianShort: string;
  tileSubsPer1000: string;
  tileClicks: string;
  notMeasured: string;
  notMeasuredInline: string;
  medianLongHint: (sample: number) => string;
  medianLongMissing: (sample: number) => string;
  medianShortHint: (sample: number) => string;
  medianShortMissing: (sample: number) => string;
  subsPer1000Hint: (shorts: string) => string;
  clicksHint: string;
  formatFootnote: string;
  channelLine: (subscribers: string, change: string, days: number) => string;
  tableTitle: string;
  tableIntro: string;
  noVideos: string;
  labelLongForm: string;
  labelShorts: string;
  inlineLongForm: string;
  inlineShorts: string;
  tableEmpty: (label: string) => string;
  tableFootnote: (minSample: number) => string;
  colVideo: string;
  colLength: string;
  colAge: string;
  colViews: string;
  colMultiplier: string;
  colRetention: string;
  colSubs: string;
  noImage: string;
  lengthLabels: Record<string, string>;
  multiplierTitle: string;
  multiplierMissingTitle: string;
  retentionLoading: string;
  retentionCaption: (date: string) => string;
  retentionMissing: string;
  chartStart: string;
  chartEnd: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    loading: "Je kanaal wordt geladen...",
    title: "Je kanaal",
    intro:
      "Je cijfers tegen je eigen normaal. De data komt uit de YouTube Analytics API en loopt 48 tot 72 uur achter.",
    syncFresh: "Data is actueel",
    syncStale: "Data kan verouderd zijn",
    signalsTitle: "Wat opvalt",
    signalsEmpty:
      "Er valt nu niets op. We melden alleen wat afwijkt van je eigen normaal, dus stil is prima.",
    tileMedianLong: "Mediaan views, long-form",
    tileMedianShort: "Mediaan views, Shorts",
    tileSubsPer1000: "Abonnees per 1.000 views (90d)",
    tileClicks: "Kliks naar shop of sponsor",
    notMeasured: "Nog niet gemeten",
    notMeasuredInline: "nog niet gemeten",
    medianLongHint: (sample) =>
      `Views over de hele levensduur van video's van 30 tot 90 dagen oud (${sample} video's).`,
    medianLongMissing: (sample) =>
      `Hiervoor zijn minstens 5 long-form video's van 30 tot 90 dagen oud nodig, nu ${sample}.`,
    medianShortHint: (sample) =>
      `Views over de hele levensduur van Shorts van 30 tot 90 dagen oud (${sample} Shorts). Nooit opgeteld bij long-form.`,
    medianShortMissing: (sample) =>
      `Hiervoor zijn minstens 5 Shorts van 30 tot 90 dagen oud nodig, nu ${sample}.`,
    subsPer1000Hint: (shorts) => `Long-form. Shorts: ${shorts}.`,
    clicksHint: "Hiervoor is een gemeten shortlink per video nodig, die laag komt eraan.",
    formatFootnote:
      "Shorts en long-form worden nooit bij elkaar opgeteld: sinds 31 maart 2025 telt een Shorts-view elke start of replay, een andere eenheid dan een view op long-form.",
    channelLine: (subscribers, change, days) =>
      `Kanaal: ${subscribers} abonnees, ${change} in ${days} dagen.`,
    tableTitle: "Wat deed wat, tegen je eigen normaal",
    tableIntro:
      "De laatste 90 dagen, gesorteerd op nieuwe abonnees. De multiplier vergelijkt views per dag met de mediaan binnen hetzelfde formaat en dezelfde lengteklasse. Klik op een rij voor de retentiecurve.",
    noVideos: "Nog geen video's in dit venster.",
    labelLongForm: "Long-form",
    labelShorts: "Shorts",
    inlineLongForm: "long-form",
    inlineShorts: "Shorts",
    tableEmpty: (label) => `Nog geen ${label} in dit venster.`,
    tableFootnote: (minSample) =>
      `Een lege multiplier betekent minder dan ${minSample} video's in die lengteklasse, dan is er geen mediaan om tegen te vergelijken. Retentie is het gemiddelde percentage dat bekeken is, met het verschil tot de mediaan van de klasse in punten.`,
    colVideo: "Video",
    colLength: "Lengte",
    colAge: "Leeftijd",
    colViews: "Views",
    colMultiplier: "Multiplier",
    colRetention: "Retentie",
    colSubs: "Abonnees /1.000 views",
    noImage: "geen beeld",
    lengthLabels: { kort: "kort (<3m)", middel: "middel (3-10m)", lang: "lang (10m+)" },
    multiplierTitle: "Views per dag tegen de mediaan binnen formaat en lengteklasse",
    multiplierMissingTitle: "Hiervoor zijn minstens 5 video's in deze lengteklasse nodig",
    retentionLoading: "De retentiecurve wordt geladen...",
    retentionCaption: (date) =>
      `Retentie van het publiek, gemeten op ${date}. Boven de 100% aan het begin betekent dat mensen de opening terugkijken. De stippellijn is 100%.`,
    retentionMissing:
      "Nog geen retentiemeting voor deze video. Meetritme: je laatste 20 video's wekelijks, elke video op dag 7 en dag 30.",
    chartStart: "start",
    chartEnd: "einde video",
  },
  en: {
    loading: "Loading your channel...",
    title: "Your channel",
    intro:
      "Your numbers against your own normal. Data comes from the YouTube Analytics API, which runs 48 to 72 hours behind.",
    syncFresh: "Data up to date",
    syncStale: "Data may be stale",
    signalsTitle: "Worth knowing",
    signalsEmpty:
      "Nothing stands out right now. We only flag what deviates from your own normal, so quiet is fine.",
    tileMedianLong: "Median views, long-form",
    tileMedianShort: "Median views, Shorts",
    tileSubsPer1000: "Subscribers per 1,000 views (90d)",
    tileClicks: "Clicks to shop or sponsor",
    notMeasured: "Not measured yet",
    notMeasuredInline: "not measured yet",
    medianLongHint: (sample) => `Lifetime views of videos 30-90 days old (${sample} videos).`,
    medianLongMissing: (sample) =>
      `Needs at least 5 long-form videos aged 30-90 days; currently ${sample}.`,
    medianShortHint: (sample) =>
      `Lifetime views of Shorts 30-90 days old (${sample} Shorts). Never added to long-form.`,
    medianShortMissing: (sample) =>
      `Needs at least 5 Shorts aged 30-90 days; currently ${sample}.`,
    subsPer1000Hint: (shorts) => `Long-form. Shorts: ${shorts}.`,
    clicksHint: "Needs a tracked shortlink per video; that layer is coming.",
    formatFootnote:
      "Shorts and long-form are never added together: since 31 March 2025 a Shorts view counts every start or replay, a different unit than a long-form view.",
    channelLine: (subscribers, change, days) =>
      `Channel: ${subscribers} subscribers, ${change} in ${days} days.`,
    tableTitle: "What did what, against your own normal",
    tableIntro:
      "Last 90 days, sorted by subscribers gained. The multiplier compares views per day with the median within the same format and length class. Click a row for the retention curve.",
    noVideos: "No videos in this window yet.",
    labelLongForm: "Long-form",
    labelShorts: "Shorts",
    inlineLongForm: "long-form",
    inlineShorts: "Shorts",
    tableEmpty: (label) => `No ${label} in this window.`,
    tableFootnote: (minSample) =>
      `An empty multiplier means fewer than ${minSample} videos in that length class; there is no median to compare against. Retention is the average percentage watched, with the difference from the class median in points.`,
    colVideo: "Video",
    colLength: "Length",
    colAge: "Age",
    colViews: "Views",
    colMultiplier: "Multiplier",
    colRetention: "Retention",
    colSubs: "Subs /1,000 views",
    noImage: "no image",
    lengthLabels: { kort: "short (<3m)", middel: "mid (3-10m)", lang: "long (10m+)" },
    multiplierTitle: "Views per day vs the median within format and length class",
    multiplierMissingTitle: "Needs at least 5 videos in this length class",
    retentionLoading: "Loading retention curve...",
    retentionCaption: (date) =>
      `Audience retention, measured ${date}. Above 100% at the start means people rewatch the opening. The dashed line is 100%.`,
    retentionMissing:
      "No retention measurement yet for this video. Measuring rhythm: your latest 20 videos weekly, every video at day 7 and day 30.",
    chartStart: "start",
    chartEnd: "end of video",
  },
};

// Getallen komen afgerond uit de Hub (hooguit een decimaal), dus de standaard
// opties zijn genoeg: het enige verschil tussen de talen is het scheidingsteken.
const fmt = (n: number | null | undefined, lang: Lang) =>
  n == null ? "-" : Number(n).toLocaleString(localeFor(lang));

function lengthLabel(cls: string | null, c: Copy): string {
  if (cls && c.lengthLabels[cls]) return c.lengthLabels[cls];
  return "-";
}

function RetentionChart({ curve, c }: { curve: RetentionResponse["curve"]; c: Copy }) {
  const points = curve.filter((p) => p.audience_watch_ratio != null);
  if (points.length < 2) return null;
  const W = 520, H = 140, PAD = 26;
  const maxY = Math.max(...points.map((p) => p.audience_watch_ratio as number), 1);
  const toX = (r: number) => PAD + r * (W - PAD * 2);
  const toY = (y: number) => H - PAD - (y / maxY) * (H - PAD * 2);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.bucket_ratio).toFixed(1)},${toY(p.audience_watch_ratio as number).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" strokeWidth="0.75" className="text-border" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" strokeWidth="0.75" className="text-border" />
      {1 <= maxY && (
        <line x1={PAD} y1={toY(1)} x2={W - PAD} y2={toY(1)} stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 3" className="text-muted" />
      )}
      <path d={`${path} L${toX(points[points.length - 1].bucket_ratio).toFixed(1)},${H - PAD} L${toX(points[0].bucket_ratio).toFixed(1)},${H - PAD} Z`} fill="rgba(60,142,255,0.12)" />
      <path d={path} fill="none" stroke="#3c8eff" strokeWidth="1.5" />
      <text x={PAD} y={H - 8} fontSize="9" fill="currentColor" className="text-muted">{c.chartStart}</text>
      <text x={W - PAD} y={H - 8} fontSize="9" fill="currentColor" textAnchor="end" className="text-muted">{c.chartEnd}</text>
      <text x={4} y={PAD + 4} fontSize="9" fill="currentColor" className="text-muted">{Math.round(maxY * 100)}%</text>
    </svg>
  );
}

function VideoTable({
  label,
  emptyLabel,
  rows,
  expanded,
  onToggle,
  retention,
  retentionLoading,
  lang,
  c,
}: {
  label: string;
  emptyLabel: string;
  rows: VideoRow[];
  expanded: string | null;
  onToggle: (id: string) => void;
  retention: RetentionResponse | null;
  retentionLoading: boolean;
  lang: Lang;
  c: Copy;
}) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">
        {label} <span className="text-muted font-normal">({rows.length})</span>
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{c.tableEmpty(emptyLabel)}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
                <th className="py-2 pr-3">{c.colVideo}</th>
                <th className="py-2 pr-3">{c.colLength}</th>
                <th className="py-2 pr-3">{c.colAge}</th>
                <th className="py-2 pr-3 text-right">{c.colViews}</th>
                <th className="py-2 pr-3 text-right">{c.colMultiplier}</th>
                <th className="py-2 pr-3 text-right">{c.colRetention}</th>
                <th className="py-2 text-right">{c.colSubs}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((v) => (
                <>
                  <tr
                    key={v.content_id}
                    onClick={() => onToggle(v.content_id)}
                    className="border-b border-border-subtle cursor-pointer hover:bg-card-hover"
                  >
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2.5">
                        <span className="w-16 h-9 shrink-0 rounded border border-border-subtle overflow-hidden bg-card flex items-center justify-center text-[9px] text-muted">
                          {v.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            c.noImage
                          )}
                        </span>
                        <span className="truncate max-w-[260px]">{v.title || v.content_id}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{lengthLabel(v.length_class, c)}</td>
                    <td className="py-2 pr-3">{v.age_days}d</td>
                    <td className="py-2 pr-3 text-right">{fmt(v.views, lang)}</td>
                    <td className="py-2 pr-3 text-right font-semibold" title={v.views_multiplier == null ? c.multiplierMissingTitle : c.multiplierTitle}>
                      {v.views_multiplier != null ? `${fmt(v.views_multiplier, lang)}x` : "-"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {v.avg_view_percentage != null ? `${fmt(Math.round(Number(v.avg_view_percentage) * 10) / 10, lang)}%` : "-"}
                      {v.retention_vs_median != null && (
                        <span className="text-muted"> ({v.retention_vs_median >= 0 ? "+" : ""}{fmt(v.retention_vs_median, lang)}pt)</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {v.subs_per_1000_views != null ? fmt(v.subs_per_1000_views, lang) : "-"}
                      {v.subscribers_gained != null && <span className="text-muted font-normal"> (+{fmt(v.subscribers_gained, lang)})</span>}
                    </td>
                  </tr>
                  {expanded === v.content_id && (
                    <tr key={`${v.content_id}-detail`} className="border-b border-border-subtle">
                      <td colSpan={7} className="py-3 px-2 bg-card/60">
                        {retentionLoading ? (
                          <p className="text-sm text-muted">{c.retentionLoading}</p>
                        ) : retention && retention.curve.length > 1 ? (
                          <div className="max-w-xl">
                            <RetentionChart curve={retention.curve} c={c} />
                            <p className="text-xs text-muted mt-1.5">
                              {c.retentionCaption(
                                retention.measured_on
                                  ? new Date(retention.measured_on).toLocaleDateString(localeFor(lang))
                                  : "-",
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted">{c.retentionMissing}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CreatorContent() {
  const lang = useLanguage();
  const langReady = useLanguageReady();
  const c = COPY[lang];
  const [summary, setSummary] = useState<Summary | null>(null);
  const [videosRes, setVideosRes] = useState<VideosResponse | null>(null);
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [retention, setRetention] = useState<RetentionResponse | null>(null);
  const [retentionLoading, setRetentionLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      portalFetch<Summary>("/creator/summary?days=28").catch(() => null),
      portalFetch<VideosResponse>("/creator/videos?days=90").catch(() => null),
      portalFetch<{ signals: SignalItem[] }>("/creator/signals").catch(() => null),
    ])
      .then(([s, v, sig]) => {
        setSummary(s);
        setVideosRes(v);
        setSignals(sig?.signals || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!expanded) { setRetention(null); return; }
    setRetentionLoading(true);
    portalFetch<RetentionResponse>(`/creator/retention?contentId=${expanded}`)
      .then(setRetention)
      .catch(() => setRetention(null))
      .finally(() => setRetentionLoading(false));
  }, [expanded]);

  const videos = videosRes?.videos || [];
  const longForm = useMemo(() => videos.filter((v) => v.content_type !== "short"), [videos]);
  const shorts = useMemo(() => videos.filter((v) => v.content_type === "short"), [videos]);
  const med = videosRes?.medians;

  // Zolang de taal niet vaststaat is er geen zin die klopt, dus alleen het
  // rondje. Daarna pas de laadtekst in de taal van de klant.
  if (!langReady) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (loading) return <p className="text-sm text-muted p-6">{c.loading}</p>;

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">{c.title}</h1>
          <p className="text-sm text-muted mt-1">{c.intro}</p>
        </div>
        {summary?.sync && (
          <span className={`text-xs px-2.5 py-1 rounded-full ${summary.sync.fresh ? "bg-accent-light text-accent" : "bg-danger-light text-danger"}`}>
            {summary.sync.fresh ? c.syncFresh : c.syncStale}
          </span>
        )}
      </div>

      {/* What's worth knowing */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">{c.signalsTitle}</h2>
        {signals.length === 0 ? (
          <p className="text-sm text-muted">{c.signalsEmpty}</p>
        ) : (
          <div className="space-y-2">
            {signals.slice(0, 5).map((sig) => (
              <details key={sig.id}>
                <summary className="cursor-pointer text-sm font-semibold">
                  {sig.headline || sig.title}
                  <span className="text-muted font-normal text-xs ml-2">
                    {new Date(sig.created_at_source).toLocaleDateString(localeFor(lang))}
                  </span>
                </summary>
                {sig.summary && (
                  <p className="text-sm text-muted whitespace-pre-line mt-1.5 ml-4 max-w-2xl">{sig.summary}</p>
                )}
              </details>
            ))}
          </div>
        )}
      </section>

      {/* The four numbers deals are priced on */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: c.tileMedianLong,
            value: med?.video?.median_lifetime_views_30_90d != null ? fmt(med.video.median_lifetime_views_30_90d, lang) : c.notMeasured,
            hint: med?.video?.median_lifetime_views_30_90d != null
              ? c.medianLongHint(med.video.sample_30_90d)
              : c.medianLongMissing(med?.video?.sample_30_90d ?? 0),
          },
          {
            label: c.tileMedianShort,
            value: med?.short?.median_lifetime_views_30_90d != null ? fmt(med.short.median_lifetime_views_30_90d, lang) : c.notMeasured,
            hint: med?.short?.median_lifetime_views_30_90d != null
              ? c.medianShortHint(med.short.sample_30_90d)
              : c.medianShortMissing(med?.short?.sample_30_90d ?? 0),
          },
          {
            label: c.tileSubsPer1000,
            value: med?.video?.subs_per_1000_views_90d != null ? fmt(med.video.subs_per_1000_views_90d, lang) : c.notMeasured,
            hint: c.subsPer1000Hint(
              med?.short?.subs_per_1000_views_90d != null ? fmt(med.short.subs_per_1000_views_90d, lang) : c.notMeasuredInline,
            ),
          },
          {
            label: c.tileClicks,
            value: c.notMeasured,
            hint: c.clicksHint,
          },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted font-semibold">{tile.label}</p>
            <p className="text-xl font-bold mt-1.5">{tile.value}</p>
            <p className="text-xs text-muted mt-1.5">{tile.hint}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted -mt-3">
        {c.formatFootnote}
        {summary?.kpis?.subscribers != null && (
          <> {c.channelLine(
            fmt(summary.kpis.subscribers, lang),
            `${summary.kpis.net_subscriber_change >= 0 ? "+" : ""}${fmt(summary.kpis.net_subscriber_change, lang)}`,
            summary.days,
          )}</>
        )}
      </p>

      {/* Every video against your own normal */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">{c.tableTitle}</h2>
          <p className="text-xs text-muted mt-1">{c.tableIntro}</p>
        </div>
        {videos.length === 0 ? (
          <p className="text-sm text-muted">{c.noVideos}</p>
        ) : (
          <>
            <VideoTable label={c.labelLongForm} emptyLabel={c.inlineLongForm} rows={longForm} expanded={expanded} onToggle={(id) => setExpanded(expanded === id ? null : id)} retention={retention} retentionLoading={retentionLoading} lang={lang} c={c} />
            <VideoTable label={c.labelShorts} emptyLabel={c.inlineShorts} rows={shorts} expanded={expanded} onToggle={(id) => setExpanded(expanded === id ? null : id)} retention={retention} retentionLoading={retentionLoading} lang={lang} c={c} />
            <p className="text-xs text-muted">{c.tableFootnote(videosRes?.min_class_sample ?? 5)}</p>
          </>
        )}
      </section>
    </div>
  );
}

export default function CreatorPage() {
  return <AuthGuard>{() => <CreatorContent />}</AuthGuard>;
}
