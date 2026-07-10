"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { portalFetch } from "@/lib/api";
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
}

interface Report {
  id: string;
  type: "weekly_report" | "monthly_report";
  title: string;
  body: string;
  created_at: string;
}

const PERIODS = [7, 14, 30];

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("nl-NL");
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
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
    <article className="rounded-[36px] border border-border bg-card px-8 py-7 shadow-[0_20px_60px_rgba(31,41,51,0.06)]">
      <p className="text-[22px] font-bold tracking-[-0.03em] text-muted-foreground">{label}</p>
      <strong className="mt-4 block text-[clamp(2.4rem,4vw,3.9rem)] font-black leading-none tracking-[-0.07em] text-foreground">
        {value}
      </strong>
      <p className="mt-4 max-w-[18rem] text-[18px] leading-[1.12] tracking-[-0.025em] text-muted-foreground">
        {context}
      </p>
    </article>
  );
}

function MetricRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-5 border-b border-border-subtle pb-4 last:border-0">
      <span className="min-w-0 text-[22px] font-black tracking-[-0.045em] text-foreground">{label}</span>
      <span className={`text-[22px] font-bold tracking-[-0.035em] ${muted ? "text-muted-foreground" : "text-foreground"}`}>
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
    <article className="grid gap-4 rounded-[22px] border border-border bg-card px-5 py-5 sm:grid-cols-[44px_minmax(0,1fr)_auto]">
      <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#eaf3ff] text-sm font-black text-accent">
        {index}
      </div>
      <div className="min-w-0">
        <h3 className="m-0 text-[22px] font-black leading-[1.05] tracking-[-0.045em] text-foreground">{title}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {meta.map((item) => (
            <span key={item} className="rounded-full border border-border bg-[#fbfcfe] px-3 py-1 text-xs font-bold text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
        <p className="mt-3 max-w-3xl text-[15px] leading-snug text-muted-foreground">{why}</p>
      </div>
      <Link
        href={href}
        className="inline-flex h-10 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm font-bold text-background"
      >
        {cta}
      </Link>
    </article>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      {(_user, client) => <DashboardContent clientName={client?.name || ""} />}
    </AuthGuard>
  );
}

function DashboardContent({ clientName }: { clientName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="grid min-h-[56vh] place-items-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!data?.kpis || !surface) {
    return (
      <section className="rounded-[36px] border border-border bg-card p-10 shadow-[0_20px_60px_rgba(31,41,51,0.06)]">
        <div className="mb-5 flex items-center gap-4">
          <img src="/stevin-icon-navy.png" alt="" className="h-11 w-11" />
          <div>
            <h1 className="text-[clamp(2.2rem,5vw,4.4rem)] font-black leading-none tracking-[-0.07em]">
              Overzicht
            </h1>
            <p className="mt-2 text-xl tracking-[-0.03em] text-muted-foreground">{clientName}</p>
          </div>
        </div>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {data?.message || "Er is nog geen campagnedata beschikbaar. Koppel eerst je kanalen, dan verschijnt hier wat veranderde en wat aandacht vraagt."}
        </p>
        <Link
          href="/dashboard/integrations"
          className="mt-7 inline-flex rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background"
        >
          Koppelingen beheren
        </Link>
      </section>
    );
  }

  const { kpis, topChannel, spendChannel } = surface;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-4">
            <img src="/stevin-icon-navy.png" alt="" className="h-12 w-12" />
            <h1 className="text-[clamp(3.2rem,6vw,5.4rem)] font-black leading-none tracking-[-0.075em] text-foreground">
              Overzicht
            </h1>
          </div>
          <p className="mt-4 text-[clamp(1.35rem,2vw,2rem)] leading-tight tracking-[-0.035em] text-muted-foreground">
            Wat veranderde er, wat vraagt actie, wat blijft stabiel.
          </p>
          {clientName && <p className="mt-2 text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">{clientName}</p>}
        </div>

        <div className="inline-flex w-fit gap-2 rounded-full border border-border bg-card p-2 shadow-[0_10px_30px_rgba(31,41,51,0.05)]">
          {PERIODS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setPeriod(days)}
              className={`rounded-full px-6 py-3 text-lg font-black transition ${
                period === days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Investering" value={fmtEur(kpis.cost)} context={`${kpis.cpc} per klik`} />
        <KpiCard label="Bereik" value={fmtNum(kpis.impressions)} context="Aantal keer getoond" />
        <KpiCard label="Klikken" value={fmtNum(kpis.clicks)} context={`${kpis.ctr}% klikpercentage`} />
        <KpiCard label="Resultaten" value={fmtNum(kpis.conversions)} context={`${kpis.cpa} per resultaat`} />
      </section>

      {(data.pendingApprovals > 0 || data.pendingBudgets > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          {data.pendingApprovals > 0 && (
            <DecisionCard
              index="01"
              title={`${data.pendingApprovals} goedkeuring${data.pendingApprovals === 1 ? "" : "en"} wacht${data.pendingApprovals === 1 ? "" : "en"}`}
              meta={["Creatives", "actie nodig"]}
              why="Er staat nieuw materiaal klaar dat pas live kan na akkoord."
              href="/dashboard/approvals"
              cta="Bekijken"
            />
          )}
          {data.pendingBudgets > 0 && (
            <DecisionCard
              index="02"
              title={`${data.pendingBudgets} budgetvoorstel${data.pendingBudgets === 1 ? "" : "len"}`}
              meta={["Budget", "beslissing"]}
              why="Er ligt een voorstel klaar om budget te verschuiven op basis van de afgelopen periode."
              href="/dashboard/budget"
              cta="Bekijken"
            />
          )}
        </section>
      )}

      <section className="rounded-[36px] border border-border bg-card px-8 py-8 shadow-[0_20px_60px_rgba(31,41,51,0.06)] lg:px-12">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-[clamp(2.4rem,4vw,4rem)] font-black leading-none tracking-[-0.07em]">
              Wat veranderde er deze periode?
            </h2>
            <p className="mt-4 max-w-3xl text-[clamp(1.25rem,2vw,1.85rem)] leading-tight tracking-[-0.035em] text-muted-foreground">
              Performance samengevat voor eindklanten. Geen diagnose-overload, wel genoeg context om een beslissing te nemen.
            </p>
          </div>
          <div className="inline-flex w-fit rounded-full border border-border bg-[#f8fafc] p-1">
            <span className="rounded-full px-4 py-2 text-sm font-black text-muted-foreground">Brand</span>
            <span className="rounded-full bg-foreground px-4 py-2 text-sm font-black text-background">Performance</span>
            <span className="rounded-full px-4 py-2 text-sm font-black text-muted-foreground">Markt</span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
          <div className="grid gap-5">
            <MetricRow label="Investering" value={surface.costTrend == null ? fmtEur(kpis.cost) : pct(surface.costTrend)} muted={surface.costTrend != null && surface.costTrend < 0} />
            <MetricRow label="Klikken" value={surface.clickTrend == null ? fmtNum(kpis.clicks) : pct(surface.clickTrend)} muted={surface.clickTrend != null && surface.clickTrend < 0} />
            <MetricRow label="Resultaten" value={surface.conversionTrend == null ? fmtNum(kpis.conversions) : pct(surface.conversionTrend)} muted={surface.conversionTrend != null && surface.conversionTrend < 0} />
            <MetricRow label="Bereik" value={surface.impressionTrend == null ? fmtNum(kpis.impressions) : pct(surface.impressionTrend)} muted={surface.impressionTrend != null && surface.impressionTrend < 0} />
          </div>
          <div className="rounded-[24px] border border-border bg-[#fbfcfe] p-6">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground">Context</p>
            <div className="mt-5 grid gap-4 text-[17px] leading-snug text-muted-foreground">
              <p>
                <strong className="text-foreground">Meeste resultaat:</strong>{" "}
                {topChannel ? `${topChannel.label} (${fmtNum(topChannel.conversions)} resultaten)` : "nog onvoldoende data"}.
              </p>
              <p>
                <strong className="text-foreground">Meeste investering:</strong>{" "}
                {spendChannel ? `${spendChannel.label} (${fmtEur(spendChannel.cost)})` : "nog onvoldoende data"}.
              </p>
              <p>
                <strong className="text-foreground">Volgende stap:</strong> bekijk open goedkeuringen of vraag Stevin om toelichting op de cijfers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[36px] border border-border bg-card px-8 py-8 shadow-[0_20px_60px_rgba(31,41,51,0.06)]">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[clamp(2rem,3vw,3rem)] font-black tracking-[-0.06em]">Meldingen</h2>
            <p className="mt-2 text-xl tracking-[-0.035em] text-muted-foreground">Wat aandacht vraagt, met genoeg context om te beslissen.</p>
          </div>
          <Link href="/dashboard/chat" className="text-sm font-bold text-accent">Vraag Stevin om uitleg →</Link>
        </div>

        <div className="grid gap-4">
          <DecisionCard
            index="01"
            title="Resultaten bewegen sterker dan investering"
            meta={["Performance", `${period} dagen`, "uitlegbaar"]}
            why="De verhouding tussen investering en resultaat is veranderd. Kijk vooral naar kanaalverschuivingen voordat er budget wordt aangepast."
            href="/dashboard/campaigns"
            cta="Campagnes"
          />
          {reports[0] && (
            <DecisionCard
              index="02"
              title={reports[0].title}
              meta={[reports[0].type === "monthly_report" ? "Maandrapport" : "Weekrapport", "rapportage"]}
              why="Er staat een recente rapportage klaar. Deze bevat de samenvatting die je normaal in het klantgesprek gebruikt."
              href="/dashboard"
              cta="Openen"
            />
          )}
        </div>
      </section>
    </div>
  );
}
