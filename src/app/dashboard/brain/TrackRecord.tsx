"use client";

/**
 * Het Dossier (Engels: Track record), D-024: het klantgeheugen als
 * chronologisch archief, per maand, met drie soorten kaarten (video,
 * besluit, mijlpaal). Data komt uit /api/portal/creator/archive, de taal
 * uit /api/portal/me (advisor_language).
 *
 * Shorts en long-form staan nooit bij elkaar opgeteld: sinds 31 maart 2025
 * telt een Shorts-view elke start of replay en is dat een andere eenheid
 * dan een view op een lange video.
 */

import { useEffect, useMemo, useState } from "react";
import { portalFetch } from "@/lib/api";

export type ArchiveLang = "nl" | "en";

interface ArchiveEntry {
  type: "video" | "milestone" | "decision";
  date: string;
  title: string;
  content_id?: string | null;
  thumbnail_url?: string | null;
  format?: "video" | "short" | null;
  length_class?: string | null;
  views?: number | null;
  views_multiplier?: number | null;
  multiplier_note?: string | null;
  multiplier_basis?: { code: "not_mature" | "too_few" | "trailing_median"; days?: number; min?: number; window?: number } | null;
  retention_pct?: number | null;
  subscribers_gained?: number | null;
  subs_per_1000_views?: number | null;
  detail?: string | null;
  category?: string | null;
  measurement?: Record<string, unknown> | null;
}

interface ArchiveMonth {
  month: string;
  entries: ArchiveEntry[];
}

interface MedianBlock {
  median_views: number | null;
  sample: number;
}

interface AudienceSlice {
  key: string;
  pct: number;
}

interface ArchiveHeader {
  subscribers: number | null;
  medians: Record<string, MedianBlock>;
  audience: { measured_on: string | null; age_gender: AudienceSlice[]; countries: AudienceSlice[] };
  mature_after_days: number;
  trailing_window: number;
  counts: { videos: number; shorts: number; decisions: number; milestones: number };
  period_months?: number;
}

interface ArchiveResponse {
  months: ArchiveMonth[];
  header: ArchiveHeader;
}

interface Copy {
  title: string;
  intro: string;
  medianVideo: string;
  medianShort: string;
  notMeasured: string;
  medianHint: (sample: number, days: number) => string;
  medianMissingHint: (sample: number) => string;
  audienceLabel: string;
  audienceMissing: string;
  audienceMissingReason: string;
  measuredOn: (date: string) => string;
  subscribersLine: (value: string) => string;
  countVideo: [string, string];
  countShort: [string, string];
  countDecision: [string, string];
  countMilestone: [string, string];
  formatVideo: string;
  formatShort: string;
  lengthLabels: Record<string, string>;
  statViews: string;
  statMultiplier: string;
  statRetention: string;
  statSubs: string;
  decisionLabel: string;
  milestoneLabel: string;
  categories: Record<string, string>;
  expectationLabel: string;
  measureTitle: string;
  measureTooFew: (label: string, before: string, after: string) => string;
  measureLine: (label: string, before: string, after: string, nBefore: string, nAfter: string) => string;
  measureRetention: (before: string, after: string) => string;
  measurePending: string;
  genders: Record<string, string>;
  footnote: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  errorTitle: string;
}

const COPY: Record<ArchiveLang, Copy> = {
  nl: {
    title: "Dossier",
    intro: "Wat er uitkwam, wat het deed en wat we bewust veranderden, maand voor maand.",
    medianVideo: "Mediaan views, video",
    medianShort: "Mediaan views, Shorts",
    notMeasured: "Nog niet gemeten",
    medianHint: (sample, days) =>
      `Mediaan over de laatste ${sample} video's van minstens ${days} dagen oud.`,
    medianMissingHint: (sample) =>
      `Er zijn ${sample} uitgerijpte video's in dit formaat, te weinig voor een mediaan.`,
    audienceLabel: "Publiek",
    audienceMissing: "Nog niet gemeten",
    audienceMissingReason: "de publieksmeting van het kanaal is nog niet binnen.",
    measuredOn: (date) => `gemeten op ${date}`,
    subscribersLine: (value) => `${value} abonnees`,
    countVideo: ["video", "video's"],
    countShort: ["Short", "Shorts"],
    countDecision: ["besluit", "besluiten"],
    countMilestone: ["mijlpaal", "mijlpalen"],
    formatVideo: "Video",
    formatShort: "Short",
    lengthLabels: { kort: "kort (<3m)", middel: "middel (3-10m)", lang: "lang (10m+)" },
    statViews: "Views",
    statMultiplier: "Multiplier",
    statRetention: "Retentie",
    statSubs: "Abonnees per 1.000 views",
    decisionLabel: "Besluit",
    milestoneLabel: "Mijlpaal",
    categories: {
      packaging: "Packaging",
      formaat: "Formaat",
      lengte: "Lengte",
      onderwerp: "Onderwerp",
      ritme: "Ritme",
      distributie: "Distributie",
    },
    expectationLabel: "Verwachting",
    measureTitle: "Meting voor en na",
    measureTooFew: (label, before, after) =>
      `${label}: te weinig video's om dit te wegen (${before} ervoor, ${after} erna).`,
    measureLine: (label, before, after, nBefore, nAfter) =>
      `${label}: van ${before} naar ${after} views per dag (mediaan, ${nBefore} video's ervoor tegen ${nAfter} erna).`,
    measureRetention: (before, after) => `Retentie van ${before} naar ${after}.`,
    measurePending: "Nog niet gemeten, de voor-en-na-meting volgt later.",
    genders: { male: "man", female: "vrouw", user_specified: "anders", other: "anders" },
    footnote:
      "Shorts en video's worden nooit bij elkaar opgeteld: sinds 31 maart 2025 telt een Shorts-view elke start of replay, een andere eenheid dan een view op een lange video.",
    loading: "Het dossier wordt geladen...",
    emptyTitle: "Het dossier is nog leeg",
    emptyBody: "Zodra er video's, besluiten en metingen zijn, verschijnen ze hier per maand.",
    errorTitle: "Het dossier kon niet worden geladen.",
  },
  en: {
    title: "Track record",
    intro: "What went out, what it did and what we deliberately changed, month by month.",
    medianVideo: "Median views, long-form",
    medianShort: "Median views, Shorts",
    notMeasured: "Not measured yet",
    medianHint: (sample, days) =>
      `Median across the last ${sample} videos that are at least ${days} days old.`,
    medianMissingHint: (sample) =>
      `There are ${sample} matured videos in this format, too few for a median.`,
    audienceLabel: "Audience",
    audienceMissing: "Not measured yet",
    audienceMissingReason: "the channel audience report has not come in yet.",
    measuredOn: (date) => `measured on ${date}`,
    subscribersLine: (value) => `${value} subscribers`,
    countVideo: ["video", "videos"],
    countShort: ["Short", "Shorts"],
    countDecision: ["decision", "decisions"],
    countMilestone: ["milestone", "milestones"],
    formatVideo: "Long-form",
    formatShort: "Short",
    lengthLabels: { kort: "short (<3m)", middel: "mid (3-10m)", lang: "long (10m+)" },
    statViews: "Views",
    statMultiplier: "Multiplier",
    statRetention: "Retention",
    statSubs: "Subscribers per 1,000 views",
    decisionLabel: "Decision",
    milestoneLabel: "Milestone",
    categories: {
      packaging: "Packaging",
      formaat: "Format",
      lengte: "Length",
      onderwerp: "Topic",
      ritme: "Rhythm",
      distributie: "Distribution",
    },
    expectationLabel: "Expectation",
    measureTitle: "Before and after",
    measureTooFew: (label, before, after) =>
      `${label}: too few videos to weigh this (${before} before, ${after} after).`,
    measureLine: (label, before, after, nBefore, nAfter) =>
      `${label}: from ${before} to ${after} views per day (median, ${nBefore} videos before against ${nAfter} after).`,
    measureRetention: (before, after) => `Retention from ${before} to ${after}.`,
    measurePending: "Not measured yet, the before and after measurement follows later.",
    genders: { male: "male", female: "female", user_specified: "other", other: "other" },
    footnote:
      "Shorts and long-form are never added together: since 31 March 2025 a Shorts view counts every start or replay, a different unit than a long-form view.",
    loading: "Loading the track record...",
    emptyTitle: "The track record is still empty",
    emptyBody: "As soon as there are videos, decisions and measurements, they appear here per month.",
    errorTitle: "The track record could not be loaded.",
  },
};

interface Ui {
  lang: ArchiveLang;
  c: Copy;
  locale: string;
  int: (value: number | null | undefined) => string;
  dec: (value: number | null | undefined) => string;
  date: (value: string) => string;
  note: (value: string | null | undefined, basis?: ArchiveEntry["multiplier_basis"]) => string | null;
}

// Datums komen als YYYY-MM-DD binnen. new Date() op zo'n string leest UTC,
// wat in een westelijke tijdzone een dag terugschuift; daarom zelf ontleden.
function parseDay(value: string): Date | null {
  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// De Hub schrijft de multiplier-notitie in het Nederlands. Voor een
// Engelstalige klant zetten we de drie bekende vormen om en nemen we het
// getal uit de notitie zelf over, nooit een eigen schatting.
function translateNote(
  note: string | null | undefined,
  lang: ArchiveLang,
  basis?: ArchiveEntry["multiplier_basis"],
): string | null {
  if (lang === "nl") return note ?? null;

  // Sinds 17 aug levert de Hub een code met getallen naast de Nederlandse
  // notitie. Daarop vertalen we; de tekstherkenning eronder is alleen nog
  // terugval voor oudere antwoorden. Zo breekt een tekstwijziging in de Hub
  // de Engelse weergave niet meer stilletjes.
  if (basis) {
    if (basis.code === "not_mature") return `less than ${basis.days ?? 30} days old`;
    if (basis.code === "too_few") return `a median needs ${basis.min ?? 5} earlier videos in this format`;
    if (basis.code === "trailing_median") {
      return `against the median of the ${basis.window ?? 10} videos before it, which have been online longer`;
    }
  }

  if (!note) return null;
  let match = /^nog geen (\d+) dagen oud$/.exec(note);
  if (match) return `less than ${match[1]} days old`;
  match = /^mediaan vanaf (\d+) eerdere video's in dit formaat$/.exec(note);
  if (match) return `a median needs ${match[1]} earlier videos in this format`;
  match = /^tegenover de mediaan van de (\d+) video's ervoor(?:, die langer online staan)?$/.exec(note);
  if (match) return `against the median of the ${match[1]} videos before it, which have been online longer`;
  return note;
}

// Getallen in de Hub-teksten staan in nl-NL-notatie (punt als duizendtal).
// Voor een Engelstalig dossier lezen we ze terug en zetten ze in de eigen
// notatie; er wordt niets bij verzonnen.
function reformatDutchNumber(value: string, ui: Ui): string {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(parsed) ? value : ui.int(parsed);
}

// De Hub schrijft de mijlpaal-regels in het Nederlands. Voor een
// Engelstalige klant zetten we de bekende vormen om, met het getal uit de
// tekst zelf; onbekende vormen laten we ongemoeid staan.
function translateMilestone(text: string | null | undefined, ui: Ui): string | null {
  if (!text) return null;
  if (ui.lang === "nl") return text;
  let match = /^\+([\d.,]+) abonnees op een dag$/.exec(text);
  if (match) return `+${reformatDutchNumber(match[1], ui)} subscribers in one day`;
  match = /^([\d.,]+) abonnees gepasseerd$/.exec(text);
  if (match) return `Passed ${reformatDutchNumber(match[1], ui)} subscribers`;
  match = /^Het dagelijkse ritme ligt rond ([\d.,]+) abonnees\.$/.exec(text);
  if (match) return `The daily rhythm sits around ${reformatDutchNumber(match[1], ui)} subscribers.`;
  return text;
}

interface MeasureSide {
  median_views_per_day?: number | null;
  median_retention_pct?: number | null;
}

interface MeasurePart {
  before?: MeasureSide;
  after?: MeasureSide;
  n_before?: number;
  n_after?: number;
  insufficient?: boolean;
}

function measurePart(measurement: Record<string, unknown> | null | undefined, key: string): MeasurePart | null {
  const raw = measurement?.[key];
  if (!raw || typeof raw !== "object") return null;
  return raw as MeasurePart;
}

export default function TrackRecord({ language }: { language: ArchiveLang }) {
  const [data, setData] = useState<ArchiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    portalFetch<ArchiveResponse>("/creator/archive?months=12")
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const ui = useMemo<Ui>(() => {
    const c = COPY[language];
    const locale = language === "en" ? "en-GB" : "nl-NL";
    return {
      lang: language,
      c,
      locale,
      int: (value) => (value == null ? "-" : Number(value).toLocaleString(locale, { maximumFractionDigits: 0 })),
      dec: (value) => (value == null ? "-" : Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })),
      date: (value) => {
        const day = parseDay(value);
        if (!day) return value;
        return day.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
      },
      note: (value, basis) => translateNote(value, language, basis),
    };
  }, [language]);

  const c = ui.c;

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="mt-4 text-[13px] text-muted-foreground">{c.loading}</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
        <h2 className="text-lg font-bold tracking-[-0.01em] text-foreground">{c.errorTitle}</h2>
        {error && <p className="mx-auto mt-2 max-w-md text-[12px] text-muted-foreground">{error}</p>}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <DossierHeader header={data.header} ui={ui} />

      {data.months.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card p-8 text-center shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
          <h2 className="text-lg font-bold tracking-[-0.01em] text-foreground">{c.emptyTitle}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-snug text-muted-foreground">{c.emptyBody}</p>
        </section>
      ) : (
        data.months.map((month) => <MonthBlock key={month.month} month={month} ui={ui} />)
      )}

      <p className="text-[12px] leading-snug text-muted-foreground">{c.footnote}</p>
    </div>
  );
}

function DossierHeader({ header, ui }: { header: ArchiveHeader; ui: Ui }) {
  const c = ui.c;
  const video = header.medians?.video;
  const short = header.medians?.short;
  const audience = header.audience;
  const countries = (audience?.countries || []).slice(0, 5);
  const ageGender = [...(audience?.age_gender || [])].sort((a, b) => b.pct - a.pct).slice(0, 4);

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([ui.locale], { type: "region" });
    } catch {
      return null;
    }
  }, [ui.locale]);

  const counts = header.counts;
  const countParts: string[] = [];
  const addCount = (value: number | undefined, words: [string, string]) => {
    if (!value) return;
    countParts.push(`${ui.int(value)} ${value === 1 ? words[0] : words[1]}`);
  };
  addCount(counts?.videos, c.countVideo);
  addCount(counts?.shorts, c.countShort);
  addCount(counts?.decisions, c.countDecision);
  addCount(counts?.milestones, c.countMilestone);
  // Abonnees is een totaal, de tellingen gaan over het opgevraagde venster.
  // Zonder dit label leest de regel als kanaal-totaal (review 17 aug), en juist
  // dit scherm wordt in een sponsorgesprek gelezen.
  const periodMonths = header.period_months;
  const countSuffix =
    countParts.length > 0 && periodMonths
      ? ui.lang === "en"
        ? ` over the last ${periodMonths} months`
        : ` in de laatste ${periodMonths} maanden`
      : "";

  return (
    <section className="rounded-2xl border border-border bg-card px-4 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)] sm:px-6">
      <h2 className="text-lg font-bold tracking-[-0.01em] text-foreground">{c.title}</h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-snug text-muted-foreground">{c.intro}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MedianTile label={c.medianVideo} block={video} header={header} ui={ui} />
        <MedianTile label={c.medianShort} block={short} header={header} ui={ui} />
      </div>

      <div className="mt-4 border-t border-border-subtle pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {c.audienceLabel}
          {audience?.measured_on && (
            <span className="ml-2 font-normal normal-case tracking-normal">({c.measuredOn(ui.date(audience.measured_on))})</span>
          )}
        </p>
        {countries.length === 0 && ageGender.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">{c.audienceMissing}</span>, {c.audienceMissingReason}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {countries.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {countries.map((item) => (
                  <span
                    key={`country-${item.key}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[12px] text-foreground"
                  >
                    {countryLabel(item.key, regionNames)}
                    <span className="text-muted-foreground">{ui.dec(item.pct)}%</span>
                  </span>
                ))}
              </div>
            )}
            {ageGender.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ageGender.map((item) => (
                  <span
                    key={`age-${item.key}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-0.5 text-[12px] text-foreground"
                  >
                    {ageGenderLabel(item.key, ui)}
                    <span className="text-muted-foreground">{ui.dec(item.pct)}%</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(header.subscribers != null || countParts.length > 0) && (
        <p className="mt-4 text-[12px] text-muted-foreground">
          {header.subscribers != null && (
            <span className="block">{c.subscribersLine(ui.int(header.subscribers))}</span>
          )}
          {countParts.length > 0 && (
            <span className="block">
              {countParts.join(", ")}
              {countSuffix}
            </span>
          )}
        </p>
      )}
    </section>
  );
}

// Landnaam in de taal van de klant. Intl.DisplayNames gooit een RangeError
// op een code die geen landcode is, dus altijd terugvallen op de code zelf.
function countryLabel(code: string, regionNames: Intl.DisplayNames | null): string {
  try {
    return regionNames?.of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

function ageGenderLabel(key: string, ui: Ui): string {
  const [age, gender] = key.split(" ");
  const genderWord = gender ? ui.c.genders[gender.toLowerCase()] || gender.toLowerCase().replace(/_/g, " ") : "";
  return genderWord ? `${age} ${genderWord}` : age;
}

function MedianTile({
  label,
  block,
  header,
  ui,
}: {
  label: string;
  block: MedianBlock | undefined;
  header: ArchiveHeader;
  ui: Ui;
}) {
  const c = ui.c;
  const sample = block?.sample ?? 0;
  const measured = block?.median_views != null;
  return (
    <div className="rounded-2xl border border-border-subtle bg-card-hover p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-bold tracking-[-0.01em] ${measured ? "text-2xl text-foreground" : "text-base text-foreground"}`}>
        {measured ? ui.int(block?.median_views) : c.notMeasured}
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
        {measured ? c.medianHint(sample, header.mature_after_days) : c.medianMissingHint(sample)}
      </p>
    </div>
  );
}

function MonthBlock({ month, ui }: { month: ArchiveMonth; ui: Ui }) {
  const day = parseDay(`${month.month}-01`);
  const raw = day ? day.toLocaleDateString(ui.locale, { month: "long", year: "numeric" }) : month.month;
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <section>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{label}</h2>
      <div className="mt-2.5 space-y-2.5">
        {month.entries.map((entry, idx) => {
          const key = `${entry.type}-${entry.content_id || entry.title}-${entry.date}-${idx}`;
          if (entry.type === "video") return <VideoCard key={key} entry={entry} ui={ui} />;
          if (entry.type === "decision") return <DecisionCard key={key} entry={entry} ui={ui} />;
          return <MilestoneCard key={key} entry={entry} ui={ui} />;
        })}
      </div>
    </section>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{label}</dt>
      <dd className={`text-[13px] ${muted ? "text-muted-foreground" : "font-semibold text-foreground"}`}>{value}</dd>
    </div>
  );
}

function VideoCard({ entry, ui }: { entry: ArchiveEntry; ui: Ui }) {
  const c = ui.c;
  const note = ui.note(entry.multiplier_note, entry.multiplier_basis);
  const hasMultiplier = entry.views_multiplier != null;
  const formatLabel = entry.format === "short" ? c.formatShort : c.formatVideo;
  const lengthLabel = entry.length_class ? c.lengthLabels[entry.length_class] : null;

  return (
    <article className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
      <div className="flex gap-3.5">
        {/* self-start: zonder dat rekt de flexrij de thumbnail uit en klopt 16:9 niet meer. */}
        <div className="aspect-video w-24 shrink-0 self-start overflow-hidden rounded-lg border border-border-subtle bg-card-hover sm:w-32">
          {entry.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.thumbnail_url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold leading-snug tracking-[-0.01em] text-foreground">{entry.title}</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {[ui.date(entry.date), formatLabel, lengthLabel].filter(Boolean).join(" · ")}
          </p>

          <dl className="mt-2.5 flex flex-wrap gap-x-6 gap-y-2">
            <Stat label={c.statViews} value={ui.int(entry.views)} />
            <Stat
              label={c.statMultiplier}
              value={hasMultiplier ? `${ui.dec(entry.views_multiplier)}x` : note || "-"}
              muted={!hasMultiplier}
            />
            <Stat label={c.statRetention} value={entry.retention_pct != null ? `${ui.dec(entry.retention_pct)}%` : "-"} />
            <Stat label={c.statSubs} value={entry.subs_per_1000_views != null ? ui.dec(entry.subs_per_1000_views) : "-"} />
          </dl>

          {hasMultiplier && note && <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>}
        </div>
      </div>
    </article>
  );
}

function DecisionCard({ entry, ui }: { entry: ArchiveEntry; ui: Ui }) {
  const c = ui.c;
  const category = entry.category ? c.categories[entry.category] || entry.category : null;
  const lines = measurementLines(entry.measurement, ui);

  return (
    <article className="rounded-2xl border border-border border-l-4 border-l-accent bg-card p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-bold text-accent">{c.decisionLabel}</span>
        {category && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {category}
          </span>
        )}
        <span className="text-[12px] text-muted-foreground">{ui.date(entry.date)}</span>
      </div>

      <p className="mt-2 text-[14px] font-bold leading-snug tracking-[-0.01em] text-foreground">{entry.title}</p>
      {entry.detail && (
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
          <span className="font-semibold text-foreground">{c.expectationLabel}:</span> {entry.detail}
        </p>
      )}

      <div className="mt-2.5 border-t border-border-subtle pt-2.5">
        {lines.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">{c.measurePending}</p>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{c.measureTitle}</p>
            {lines.map((line, idx) => (
              <p key={idx} className="mt-1 text-[12px] leading-snug text-muted-foreground">
                {line}
              </p>
            ))}
          </>
        )}
      </div>
    </article>
  );
}

// Voor en na per formaat, apart gehouden: een Shorts-view en een view op een
// lange video zijn verschillende eenheden en gaan nooit samen in een cijfer.
function measurementLines(measurement: Record<string, unknown> | null | undefined, ui: Ui): string[] {
  const c = ui.c;
  const lines: string[] = [];
  const formats: Array<{ key: string; label: string }> = [
    { key: "video", label: c.formatVideo },
    { key: "short", label: c.formatShort },
  ];

  for (const format of formats) {
    const part = measurePart(measurement, format.key);
    if (!part) continue;
    if (part.insufficient) {
      lines.push(c.measureTooFew(format.label, ui.int(part.n_before ?? 0), ui.int(part.n_after ?? 0)));
      continue;
    }
    const before = part.before?.median_views_per_day;
    const after = part.after?.median_views_per_day;
    if (before == null || after == null) continue;
    let line = c.measureLine(
      format.label,
      ui.int(before),
      ui.int(after),
      ui.int(part.n_before ?? 0),
      ui.int(part.n_after ?? 0),
    );
    const retentionBefore = part.before?.median_retention_pct;
    const retentionAfter = part.after?.median_retention_pct;
    if (retentionBefore != null && retentionAfter != null) {
      line += ` ${c.measureRetention(`${ui.dec(retentionBefore)}%`, `${ui.dec(retentionAfter)}%`)}`;
    }
    lines.push(line);
  }

  return lines;
}

function MilestoneCard({ entry, ui }: { entry: ArchiveEntry; ui: Ui }) {
  const c = ui.c;
  const title = translateMilestone(entry.title, ui);
  const detail = translateMilestone(entry.detail, ui);
  return (
    <article className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-2xl border border-border-subtle bg-card px-4 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{c.milestoneLabel}</span>
      <span className="text-[13px] font-semibold text-foreground">{title}</span>
      <span className="text-[12px] text-muted-foreground">{ui.date(entry.date)}</span>
      {detail && <span className="text-[12px] text-muted-foreground">{detail}</span>}
    </article>
  );
}
