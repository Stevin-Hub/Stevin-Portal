"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { portalFetch } from "@/lib/api";
import { getClient } from "@/lib/auth";
import { useLanguage, useLanguageReady, localeFor, type Lang } from "@/lib/useLanguage";
import { toast } from "sonner";

interface DashboardData {
  kpis: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: string;
    cpc: string;
    cpa: string;
  } | null;
  channels: Array<{
    source: string;
    label: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: string;
    cpc: string;
  }>;
  trend: Array<{ date: string; impressions: number; clicks: number; cost: number; conversions: number }>;
  pendingApprovals: number;
  pendingBudgets: number;
  period: { days: number; since: string };
  message?: string;
  /** Machineleesbare reden bij een lege staat, zodat het portaal zelf de taal kiest. */
  reason?: "no_campaigns_linked" | "no_data_yet" | "creator_only";
}

interface Report {
  id: string;
  type: "weekly_report" | "monthly_report";
  /**
   * De kop zoals de Hub hem heeft opgeslagen, inclusief de periode
   * ("Weekrapportage Van Gestel, week 11-05-2026 t/m 17-05-2026"). Nooit
   * vervangen door een label uit type: dan verdwijnt de periode van het scherm
   * en zijn twee weekrapportages van dezelfde klant niet meer uit elkaar te
   * houden. Oudere rijen dragen een eigen kop, bijvoorbeeld
   * "Wekelijkse digest LUMOS, week 19", dus hier niets uit afleiden.
   */
  title: string;
  body: string;
  created_at: string;
  /**
   * Taal waarin de Hub deze tekst heeft geschreven. Het rapport-sjabloon is
   * Nederlands, dus dit is "nl" en de kop hierboven ook. Ontbreekt het veld,
   * dan draait er een oudere Hub en zegt het portaal er niets over.
   */
  bodyLanguage?: Lang;
}

interface Copy {
  overview: string;
  headline: string;
  emptyBody: string;
  emptyBodyNoData: string;
  emptyBodyCreator: string;
  toCreator: string;
  manageIntegrations: string;
  connectFailed: (reason: string) => string;
  connectErrors: Record<string, string>;
  kpiSpend: string;
  kpiSpendContext: (cpc: string) => string;
  kpiReach: string;
  kpiReachContext: string;
  kpiClicks: string;
  kpiClicksContext: (ctr: string) => string;
  kpiResults: string;
  kpiResultsContext: (cpa: string) => string;
  approvalsTitle: (count: number) => string;
  approvalsMeta: string[];
  approvalsWhy: string;
  budgetsTitle: (count: number) => string;
  budgetsMeta: string[];
  budgetsWhy: string;
  view: string;
  changeTitle: string;
  changeIntro: string;
  contextLabel: string;
  mostResults: string;
  mostSpend: string;
  nextStep: string;
  nextStepBody: string;
  resultsCount: (label: string, value: string) => string;
  noData: string;
  channelsTitle: string;
  channelsIntro: (days: number) => string;
  thChannel: string;
  thSpend: string;
  thReach: string;
  thClicks: string;
  thResults: string;
  thPerResult: string;
  alertsTitle: string;
  alertsIntro: string;
  askStevin: string;
  alertTitle: string;
  alertMeta: (days: number) => string[];
  alertWhy: string;
  campaigns: string;
  reportsTitle: string;
  reportsIntro: string;
  /**
   * Melding dat de rapportages zelf in een andere taal staan dan dit scherm.
   * null als er niets te melden valt, want dan lopen scherm en rapport gelijk.
   */
  reportsOtherLanguage: string | null;
  monthlyReport: string;
  weeklyReport: string;
  read: string;
  close: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    overview: "Overzicht",
    headline: "Wat veranderde er, wat vraagt actie, wat blijft stabiel.",
    emptyBody:
      "Er is nog geen campagnedata beschikbaar. Koppel eerst je kanalen, dan verschijnt hier wat veranderde en wat aandacht vraagt.",
    emptyBodyNoData:
      "Je kanalen zijn gekoppeld, maar er is over deze periode nog geen data binnengekomen.",
    emptyBodyCreator:
      "Er lopen geen advertenties voor je. De cijfers van je eigen kanaal staan bij Creator.",
    toCreator: "Naar Creator",
    manageIntegrations: "Koppelingen beheren",
    connectFailed: (reason) => `Koppelen mislukt: ${reason}`,
    connectErrors: {
      denied: "je hebt de toegang geweigerd",
      state_expired: "de koppel-link is verlopen, start het koppelen opnieuw",
      pkce_missing: "de koppel-sessie is onderweg verlopen, start het koppelen opnieuw",
      token_exchange_failed: "het platform gaf geen toegang terug, probeer het opnieuw",
      long_token_failed: "het platform gaf geen toegang terug, probeer het opnieuw",
      no_refresh_token:
        "de koppeling gaf geen blijvende toegang terug. Trek de toegang in bij het platform en koppel opnieuw",
      tiktok_api_error: "TikTok gaf een foutmelding terug, probeer het over een paar minuten opnieuw",
      invalid_callback: "het platform stuurde een onvolledig antwoord terug, probeer het opnieuw",
      callback_failed: "het koppelen is niet afgerond, probeer het opnieuw",
      server_error: "er ging iets mis aan onze kant, probeer het later opnieuw",
      generic: "het koppelen lukte niet, probeer het opnieuw of laat het ons weten",
    },
    kpiSpend: "Investering",
    kpiSpendContext: (cpc) => `${cpc} per klik`,
    kpiReach: "Bereik",
    kpiReachContext: "Aantal keer getoond",
    kpiClicks: "Klikken",
    kpiClicksContext: (ctr) => `${ctr}% klikpercentage`,
    kpiResults: "Resultaten",
    kpiResultsContext: (cpa) => `${cpa} per resultaat`,
    approvalsTitle: (count) =>
      `${count} goedkeuring${count === 1 ? "" : "en"} wacht${count === 1 ? "" : "en"}`,
    approvalsMeta: ["Creatives", "actie nodig"],
    approvalsWhy: "Er staat nieuw materiaal klaar dat pas live kan na akkoord.",
    budgetsTitle: (count) => `${count} budgetvoorstel${count === 1 ? "" : "len"}`,
    budgetsMeta: ["Budget", "beslissing"],
    budgetsWhy: "Er ligt een voorstel klaar om budget te verschuiven op basis van de afgelopen periode.",
    view: "Bekijken",
    changeTitle: "Wat veranderde er deze periode?",
    changeIntro: "Tweede helft van de periode vergeleken met de eerste helft.",
    contextLabel: "Context",
    mostResults: "Meeste resultaat:",
    mostSpend: "Meeste investering:",
    nextStep: "Volgende stap:",
    nextStepBody: "bekijk open goedkeuringen of vraag Stevin om toelichting op de cijfers.",
    resultsCount: (label, value) => `${label} (${value} resultaten)`,
    noData: "nog onvoldoende data",
    channelsTitle: "Per kanaal",
    channelsIntro: (days) => `Waar de investering en de resultaten vandaan komen, afgelopen ${days} dagen.`,
    thChannel: "Kanaal",
    thSpend: "Investering",
    thReach: "Bereik",
    thClicks: "Klikken",
    thResults: "Resultaten",
    thPerResult: "Per resultaat",
    alertsTitle: "Meldingen",
    alertsIntro: "Wat aandacht vraagt, met genoeg context om te beslissen.",
    askStevin: "Vraag Stevin om uitleg",
    alertTitle: "Resultaten bewegen sterker dan investering",
    alertMeta: (days) => ["Performance", `${days} dagen`, "uitlegbaar"],
    alertWhy:
      "De verhouding tussen investering en resultaat is veranderd. Kijk vooral naar kanaalverschuivingen voordat er budget wordt aangepast.",
    campaigns: "Campagnes",
    reportsTitle: "Rapportages",
    reportsIntro: "De samenvattingen die je normaal in het klantgesprek krijgt.",
    reportsOtherLanguage: null,
    monthlyReport: "Maandrapport",
    weeklyReport: "Weekrapport",
    read: "Lezen",
    close: "Sluiten",
  },
  en: {
    overview: "Overview",
    headline: "What changed, what needs action, what stays stable.",
    emptyBody:
      "There is no campaign data yet. Connect your channels first, then you will see here what changed and what needs attention.",
    emptyBodyNoData:
      "Your channels are connected, but no data has come in for this period yet.",
    emptyBodyCreator:
      "There are no ads running for you. The numbers for your own channel are on the Creator tab.",
    toCreator: "Go to Creator",
    manageIntegrations: "Manage integrations",
    connectFailed: (reason) => `Connecting failed: ${reason}`,
    connectErrors: {
      denied: "you denied access",
      state_expired: "the connection link has expired, please start again",
      pkce_missing: "the connection session expired along the way, please start again",
      token_exchange_failed: "the platform did not hand back access, please try again",
      long_token_failed: "the platform did not hand back access, please try again",
      no_refresh_token:
        "the connection did not hand back lasting access. Revoke the access at the platform and connect again",
      tiktok_api_error: "TikTok returned an error, please try again in a few minutes",
      invalid_callback: "the platform sent back an incomplete answer, please try again",
      callback_failed: "the connection was not completed, please try again",
      server_error: "something went wrong on our side, please try again later",
      generic: "connecting did not work, please try again or let us know",
    },
    kpiSpend: "Investment",
    kpiSpendContext: (cpc) => `${cpc} per click`,
    kpiReach: "Reach",
    kpiReachContext: "Times shown",
    kpiClicks: "Clicks",
    kpiClicksContext: (ctr) => `${ctr}% click rate`,
    kpiResults: "Results",
    kpiResultsContext: (cpa) => `${cpa} per result`,
    approvalsTitle: (count) => `${count} approval${count === 1 ? "" : "s"} waiting`,
    approvalsMeta: ["Creatives", "action needed"],
    approvalsWhy: "New material is ready that can only go live once you approve it.",
    budgetsTitle: (count) => `${count} budget proposal${count === 1 ? "" : "s"}`,
    budgetsMeta: ["Budget", "decision"],
    budgetsWhy: "There is a proposal ready to shift budget, based on the period behind us.",
    view: "View",
    changeTitle: "What changed this period?",
    changeIntro: "The second half of the period compared with the first half.",
    contextLabel: "Context",
    mostResults: "Most results:",
    mostSpend: "Most investment:",
    nextStep: "Next step:",
    nextStepBody: "look at the open approvals or ask Stevin to talk you through the numbers.",
    resultsCount: (label, value) => `${label} (${value} results)`,
    noData: "not enough data yet",
    channelsTitle: "Per channel",
    channelsIntro: (days) => `Where the investment and the results come from, the last ${days} days.`,
    thChannel: "Channel",
    thSpend: "Investment",
    thReach: "Reach",
    thClicks: "Clicks",
    thResults: "Results",
    thPerResult: "Per result",
    alertsTitle: "Alerts",
    alertsIntro: "What needs attention, with enough context to decide.",
    askStevin: "Ask Stevin to explain",
    alertTitle: "Results are moving more than investment",
    alertMeta: (days) => ["Performance", `${days} days`, "explainable"],
    alertWhy:
      "The ratio between investment and result has changed. Look at shifts between channels first, before any budget is adjusted.",
    campaigns: "Campaigns",
    reportsTitle: "Reports",
    reportsIntro: "The summaries you would normally get in a review meeting.",
    reportsOtherLanguage: "Your consultant writes these reports in Dutch.",
    monthlyReport: "Monthly report",
    weeklyReport: "Weekly report",
    read: "Read",
    close: "Close",
  },
};

const PERIODS = [7, 14, 30];

/**
 * Foutcode van de Hub omzetten naar een zin voor de klant.
 *
 * Loopt een koppeling stuk voordat de Hub weet naar welke klant hij terug moet,
 * dan komt de klant hier binnen op /dashboard?platform=meta&error=denied. De
 * codes: denied, invalid_callback, state_expired, pkce_missing,
 * token_exchange_failed, long_token_failed, no_refresh_token, tiktok_api_error
 * en server_error. Oudere links dragen nog de platformvariant
 * meta_callback_failed, google_ads_callback_failed,
 * google_analytics_callback_failed, google_search_console_callback_failed,
 * google_tag_manager_callback_failed, linkedin_callback_failed,
 * tiktok_callback_failed, x_callback_failed of snapchat_callback_failed; die
 * krijgen allemaal dezelfde zin. Onbekende codes vallen terug op een algemene
 * zin, nooit op de kale code.
 */
function connectErrorText(code: string, lang: Lang): string {
  const errors = COPY[lang].connectErrors;
  if (errors[code]) return errors[code];
  if (code.endsWith("_callback_failed")) return errors.callback_failed;
  return errors.generic;
}

function fmtNum(n: number, locale: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(locale);
}

// Bedragen blijven euro's, alleen de notatie volgt de taal van de klant.
function fmtEur(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(delta: number): string {
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function calcTrend(data: DashboardData, field: keyof DashboardData["trend"][0]): number | null {
  if (data.trend.length < 4) return null;
  const mid = Math.floor(data.trend.length / 2);
  const first = data.trend.slice(0, mid).reduce((sum, day) => sum + (Number(day[field]) || 0), 0);
  const second = data.trend.slice(mid).reduce((sum, day) => sum + (Number(day[field]) || 0), 0);
  if (!first) return null;
  return ((second - first) / first) * 100;
}

function KpiCard({ label, value, context }: { label: string; value: string; context: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card px-5 py-4 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{label}</p>
      <strong className="mt-1.5 block text-[26px] font-bold leading-none tracking-[-0.02em] text-foreground">
        {value}
      </strong>
      <p className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{context}</p>
    </article>
  );
}

function MetricRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-5 border-b border-border-subtle pb-2.5 last:border-0">
      <span className="min-w-0 text-[14px] font-semibold text-foreground">{label}</span>
      <span className={`text-[14px] font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function DecisionCard({
  index,
  title,
  meta,
  why,
  href,
  cta,
}: {
  index: string;
  title: string;
  meta: string[];
  why: string;
  href: string;
  cta: string;
}) {
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-card px-4 py-3.5 sm:grid-cols-[36px_minmax(0,1fr)_auto]">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#eaf3ff] text-xs font-bold text-accent">
        {index}
      </div>
      <div className="min-w-0">
        <h3 className="m-0 text-[14.5px] font-semibold leading-snug text-foreground">{title}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {meta.map((item) => (
            <span key={item} className="rounded-full border border-border bg-[#fbfcfe] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-snug text-muted-foreground">{why}</p>
      </div>
      <Link
        href={href}
        className="inline-flex h-9 items-center justify-center self-center rounded-full border border-foreground bg-foreground px-4 text-[13px] font-semibold text-background"
      >
        {cta}
      </Link>
    </article>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      {(_user, client) => (
        <DashboardContent clientName={client?.name || ""} clientSlug={client?.slug || ""} />
      )}
    </AuthGuard>
  );
}

function DashboardContent({ clientName, clientSlug }: { clientName: string; clientSlug: string }) {
  const lang = useLanguage();
  const langReady = useLanguageReady();
  const c = COPY[lang];
  const locale = localeFor(lang);
  const router = useRouter();
  const pathname = usePathname();
  // Een koppeling die stukloopt voordat de Hub de slug kent, komt hier terug
  // met ?platform=...&error=... Zonder deze melding stond de klant weer op zijn
  // overzicht alsof er niets was gebeurd. De code komt uit
  // window.location.search en niet uit useSearchParams, zodat deze pagina geen
  // Suspense-grens nodig heeft; het is altijd een verse lading vanaf het
  // platform, net als bij goedkeuringen en budget.
  const [connectError, setConnectError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  // De knop naar de koppelingen bouwt /dashboard/<slug>/integrations. Zonder
  // slug werd dat /dashboard//integrations, een dode pagina. De slug komt uit
  // de sessie; bij de Google-login staat die niet in localStorage, dan haalt
  // /me hem alsnog op. Blijft hij leeg, dan tonen we de knop niet.
  const [slug, setSlug] = useState(clientSlug || getClient()?.slug || "");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (!code) return;
    setConnectError(code);
    // Parameter uit de URL halen, anders herhaalt elke refresh de melding.
    router.replace(pathname);
  }, [router, pathname]);

  useEffect(() => {
    if (!connectError) return;
    // Vaste id: komt de taal van de klant een tel later binnen, dan vervangt de
    // melding zichzelf in plaats van er een tweede naast te zetten.
    toast.error(c.connectFailed(connectErrorText(connectError, lang)), { id: "portal-connect-error" });
  }, [connectError, lang, c]);

  useEffect(() => {
    if (slug) return;
    let active = true;
    portalFetch<{ client?: { slug?: string } | null }>("/me")
      .then((me) => {
        if (active && me.client?.slug) setSlug(me.client.slug);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      portalFetch<DashboardData>(`/dashboard?days=${period}`),
      portalFetch<{ reports: Report[] }>("/reports").catch(() => ({ reports: [] })),
    ])
      .then(([dashboard, reportData]) => {
        setData(dashboard);
        setReports(reportData.reports);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [period]);

  const surface = useMemo(() => {
    if (!data?.kpis) return null;
    const kpis = data.kpis;
    const costTrend = calcTrend(data, "cost");
    const clickTrend = calcTrend(data, "clicks");
    const conversionTrend = calcTrend(data, "conversions");
    const impressionTrend = calcTrend(data, "impressions");
    const topChannel = [...data.channels].sort((a, b) => b.conversions - a.conversions)[0];
    const spendChannel = [...data.channels].sort((a, b) => b.cost - a.cost)[0];

    return {
      kpis,
      costTrend,
      clickTrend,
      conversionTrend,
      impressionTrend,
      topChannel,
      spendChannel,
    };
  }, [data]);

  // langReady erbij: de taal komt uit /me en tot die er is klopt geen enkele
  // zin op dit scherm. De spinner heeft geen taal, dus die kan blijven staan.
  if (loading || !langReady) {
    return (
      <div className="grid min-h-[56vh] place-items-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!data?.kpis || !surface) {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
        <div className="mb-4 flex items-center gap-3">
          <img src="/stevin-icon-navy.png" alt="" className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.01em]">{c.overview}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{clientName}</p>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {data?.reason === "creator_only"
            ? c.emptyBodyCreator
            : data?.reason === "no_data_yet"
              ? c.emptyBodyNoData
              : c.emptyBody}
        </p>
        {/* Een creator-klant heeft niets aan een koppelknop: zijn kanaal hangt
            er al aan, zijn cijfers staan alleen op een ander tabblad. */}
        {data?.reason === "creator_only" ? (
          <Link
            href="/dashboard/creator"
            className="mt-5 inline-flex rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background"
          >
            {c.toCreator}
          </Link>
        ) : (
          slug && (
            <Link
              href={`/dashboard/${slug}/integrations`}
              className="mt-5 inline-flex rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background"
            >
              {c.manageIntegrations}
            </Link>
          )
        )}
      </section>
    );
  }

  const { kpis, topChannel, spendChannel } = surface;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{c.overview}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-foreground">
            {c.headline}
          </h1>
        </div>

        <div className="inline-flex w-fit gap-1 rounded-full border border-border bg-card p-1 shadow-[0_8px_24px_rgba(31,41,51,0.05)]">
          {PERIODS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPeriod(days)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                period === days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={c.kpiSpend} value={fmtEur(kpis.cost, locale)} context={c.kpiSpendContext(kpis.cpc)} />
        <KpiCard label={c.kpiReach} value={fmtNum(kpis.impressions, locale)} context={c.kpiReachContext} />
        <KpiCard label={c.kpiClicks} value={fmtNum(kpis.clicks, locale)} context={c.kpiClicksContext(kpis.ctr)} />
        <KpiCard label={c.kpiResults} value={fmtNum(kpis.conversions, locale)} context={c.kpiResultsContext(kpis.cpa)} />
      </section>

      {(data.pendingApprovals > 0 || data.pendingBudgets > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          {data.pendingApprovals > 0 && (
            <DecisionCard
              index="01"
              title={c.approvalsTitle(data.pendingApprovals)}
              meta={c.approvalsMeta}
              why={c.approvalsWhy}
              href="/dashboard/approvals"
              cta={c.view}
            />
          )}
          {data.pendingBudgets > 0 && (
            <DecisionCard
              index="02"
              title={c.budgetsTitle(data.pendingBudgets)}
              meta={c.budgetsMeta}
              why={c.budgetsWhy}
              href="/dashboard/budget"
              cta={c.view}
            />
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.01em]">{c.changeTitle}</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-snug text-muted-foreground">
              {c.changeIntro}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
          <div className="grid content-start gap-2.5">
            <MetricRow label={c.kpiSpend} value={surface.costTrend == null ? fmtEur(kpis.cost, locale) : pct(surface.costTrend)} muted={surface.costTrend != null && surface.costTrend < 0} />
            <MetricRow label={c.kpiClicks} value={surface.clickTrend == null ? fmtNum(kpis.clicks, locale) : pct(surface.clickTrend)} muted={surface.clickTrend != null && surface.clickTrend < 0} />
            <MetricRow label={c.kpiResults} value={surface.conversionTrend == null ? fmtNum(kpis.conversions, locale) : pct(surface.conversionTrend)} muted={surface.conversionTrend != null && surface.conversionTrend < 0} />
            <MetricRow label={c.kpiReach} value={surface.impressionTrend == null ? fmtNum(kpis.impressions, locale) : pct(surface.impressionTrend)} muted={surface.impressionTrend != null && surface.impressionTrend < 0} />
          </div>
          <div className="rounded-xl border border-border bg-[#fbfcfe] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{c.contextLabel}</p>
            <div className="mt-2.5 grid gap-2 text-[13px] leading-snug text-muted-foreground">
              <p>
                <strong className="font-semibold text-foreground">{c.mostResults}</strong>{" "}
                {topChannel ? c.resultsCount(topChannel.label, fmtNum(topChannel.conversions, locale)) : c.noData}.
              </p>
              <p>
                <strong className="font-semibold text-foreground">{c.mostSpend}</strong>{" "}
                {spendChannel ? `${spendChannel.label} (${fmtEur(spendChannel.cost, locale)})` : c.noData}.
              </p>
              <p>
                <strong className="font-semibold text-foreground">{c.nextStep}</strong> {c.nextStepBody}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Performance-rapport per kanaal: de ruimte gebruiken voor inhoud
          in plaats van witruimte (Koen, 10 jul). Data zit al in /dashboard. */}
      {data.channels.length > 0 && (
        <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-[-0.01em]">{c.channelsTitle}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">{c.channelsIntro(period)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">{c.thChannel}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{c.thSpend}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{c.thReach}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{c.thClicks}</th>
                  <th className="py-2 pr-4 text-right font-semibold">{c.thResults}</th>
                  <th className="py-2 text-right font-semibold">{c.thPerResult}</th>
                </tr>
              </thead>
              <tbody>
                {[...data.channels]
                  .sort((a, b) => b.cost - a.cost)
                  .map((ch) => (
                    <tr key={ch.source} className="border-b border-border-subtle last:border-0">
                      <td className="py-2.5 pr-4 font-semibold text-foreground">{ch.label}</td>
                      <td className="py-2.5 pr-4 text-right text-foreground">{fmtEur(ch.cost, locale)}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtNum(ch.impressions, locale)}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtNum(ch.clicks, locale)}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-foreground">{fmtNum(ch.conversions, locale)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {ch.conversions > 0 ? fmtEur(ch.cost / ch.conversions, locale) : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.01em]">{c.alertsTitle}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{c.alertsIntro}</p>
          </div>
          <Link href="/dashboard/chat" className="text-[13px] font-semibold text-accent">{c.askStevin}</Link>
        </div>

        <div className="grid gap-3">
          <DecisionCard
            index="01"
            title={c.alertTitle}
            meta={c.alertMeta(period)}
            why={c.alertWhy}
            href="/dashboard/campaigns"
            cta={c.campaigns}
          />
        </div>
      </section>

      {reports.length > 0 && (
        <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
          <div className="mb-3">
            <h2 className="text-lg font-bold tracking-[-0.01em]">{c.reportsTitle}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{c.reportsIntro}</p>
            {/* De kop en de tekst van een rapportage komen kant en klaar uit de
                Hub en staan in het Nederlands. Bij een klant die het portaal in
                het Engels leest, zegt dit scherm dat er dus bij, in plaats van
                een Engels label boven een Nederlandse tekst te zetten. Stuurt de
                Hub geen taal mee, dan claimt het portaal hier niets. */}
            {c.reportsOtherLanguage && reports.some((r) => r.bodyLanguage && r.bodyLanguage !== lang) && (
              <p className="mt-1 text-[12px] text-muted-foreground">{c.reportsOtherLanguage}</p>
            )}
          </div>
          <div className="grid gap-2">
            {reports.slice(0, 3).map((r) => (
              <details key={r.id} className="group rounded-xl border border-border bg-[#fbfcfe] px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="min-w-0">
                    {/* De kop is de titel van de Hub, want daar zit de periode in.
                        Die kan lang worden, dus title= zet de volledige regel er
                        nog eens onder en maakt truncate ongevaarlijk. Het type
                        ernaast is de indeling van het portaal zelf en mag wel
                        vertaald worden; de melding boven de lijst vertelt in
                        welke taal de tekst eronder staat. */}
                    <span className="block truncate text-[14px] font-semibold text-foreground" title={r.title}>
                      {r.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {r.type === "monthly_report" ? c.monthlyReport : c.weeklyReport} ·{" "}
                      {new Date(r.created_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                  <span className="flex-none text-[12px] font-semibold text-accent group-open:hidden">{c.read}</span>
                  <span className="hidden flex-none text-[12px] font-semibold text-muted-foreground group-open:block">{c.close}</span>
                </summary>
                <p className="mt-3 whitespace-pre-line border-t border-border-subtle pt-3 text-[13px] leading-relaxed text-muted-foreground">
                  {r.body}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
