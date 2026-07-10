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
      <section className="rounded-2xl border border-border bg-card p-8 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
        <div className="mb-4 flex items-center gap-3">
          <img src="/stevin-icon-navy.png" alt="" className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.01em]">Overzicht</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{clientName}</p>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {data?.message || "Er is nog geen campagnedata beschikbaar. Koppel eerst je kanalen, dan verschijnt hier wat veranderde en wat aandacht vraagt."}
        </p>
        <Link
          href="/dashboard/integrations"
          className="mt-5 inline-flex rounded-full bg-foreground px-5 py-2.5 text-[13px] font-semibold text-background"
        >
          Koppelingen beheren
        </Link>
      </section>
    );
  }

  const { kpis, topChannel, spendChannel } = surface;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Overzicht</p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.01em] text-foreground">
            Wat veranderde er, wat vraagt actie, wat blijft stabiel.
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

      <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.01em]">Wat veranderde er deze periode?</h2>
            <p className="mt-1 max-w-3xl text-[13px] leading-snug text-muted-foreground">
              Tweede helft van de periode vergeleken met de eerste helft.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.7fr)]">
          <div className="grid content-start gap-2.5">
            <MetricRow label="Investering" value={surface.costTrend == null ? fmtEur(kpis.cost) : pct(surface.costTrend)} muted={surface.costTrend != null && surface.costTrend < 0} />
            <MetricRow label="Klikken" value={surface.clickTrend == null ? fmtNum(kpis.clicks) : pct(surface.clickTrend)} muted={surface.clickTrend != null && surface.clickTrend < 0} />
            <MetricRow label="Resultaten" value={surface.conversionTrend == null ? fmtNum(kpis.conversions) : pct(surface.conversionTrend)} muted={surface.conversionTrend != null && surface.conversionTrend < 0} />
            <MetricRow label="Bereik" value={surface.impressionTrend == null ? fmtNum(kpis.impressions) : pct(surface.impressionTrend)} muted={surface.impressionTrend != null && surface.impressionTrend < 0} />
          </div>
          <div className="rounded-xl border border-border bg-[#fbfcfe] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Context</p>
            <div className="mt-2.5 grid gap-2 text-[13px] leading-snug text-muted-foreground">
              <p>
                <strong className="font-semibold text-foreground">Meeste resultaat:</strong>{" "}
                {topChannel ? `${topChannel.label} (${fmtNum(topChannel.conversions)} resultaten)` : "nog onvoldoende data"}.
              </p>
              <p>
                <strong className="font-semibold text-foreground">Meeste investering:</strong>{" "}
                {spendChannel ? `${spendChannel.label} (${fmtEur(spendChannel.cost)})` : "nog onvoldoende data"}.
              </p>
              <p>
                <strong className="font-semibold text-foreground">Volgende stap:</strong> bekijk open goedkeuringen of vraag Stevin om toelichting op de cijfers.
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
              <h2 className="text-lg font-bold tracking-[-0.01em]">Per kanaal</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">Waar de investering en de resultaten vandaan komen, afgelopen {period} dagen.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Kanaal</th>
                  <th className="py-2 pr-4 text-right font-semibold">Investering</th>
                  <th className="py-2 pr-4 text-right font-semibold">Bereik</th>
                  <th className="py-2 pr-4 text-right font-semibold">Klikken</th>
                  <th className="py-2 pr-4 text-right font-semibold">Resultaten</th>
                  <th className="py-2 text-right font-semibold">Per resultaat</th>
                </tr>
              </thead>
              <tbody>
                {[...data.channels]
                  .sort((a, b) => b.cost - a.cost)
                  .map((ch) => (
                    <tr key={ch.source} className="border-b border-border-subtle last:border-0">
                      <td className="py-2.5 pr-4 font-semibold text-foreground">{ch.label}</td>
                      <td className="py-2.5 pr-4 text-right text-foreground">{fmtEur(ch.cost)}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtNum(ch.impressions)}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{fmtNum(ch.clicks)}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-foreground">{fmtNum(ch.conversions)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {ch.conversions > 0 ? fmtEur(ch.cost / ch.conversions) : "-"}
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
            <h2 className="text-lg font-bold tracking-[-0.01em]">Meldingen</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Wat aandacht vraagt, met genoeg context om te beslissen.</p>
          </div>
          <Link href="/dashboard/chat" className="text-[13px] font-semibold text-accent">Vraag Stevin om uitleg</Link>
        </div>

        <div className="grid gap-3">
          <DecisionCard
            index="01"
            title="Resultaten bewegen sterker dan investering"
            meta={["Performance", `${period} dagen`, "uitlegbaar"]}
            why="De verhouding tussen investering en resultaat is veranderd. Kijk vooral naar kanaalverschuivingen voordat er budget wordt aangepast."
            href="/dashboard/campaigns"
            cta="Campagnes"
          />
        </div>
      </section>

      {reports.length > 0 && (
        <section className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_12px_32px_rgba(31,41,51,0.05)]">
          <div className="mb-3">
            <h2 className="text-lg font-bold tracking-[-0.01em]">Rapportages</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">De samenvattingen die je normaal in het klantgesprek krijgt.</p>
          </div>
          <div className="grid gap-2">
            {reports.slice(0, 3).map((r) => (
              <details key={r.id} className="group rounded-xl border border-border bg-[#fbfcfe] px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-foreground">{r.title}</span>
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {r.type === "monthly_report" ? "Maandrapport" : "Weekrapport"} ·{" "}
                      {new Date(r.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                  <span className="flex-none text-[12px] font-semibold text-accent group-open:hidden">Lezen</span>
                  <span className="hidden flex-none text-[12px] font-semibold text-muted-foreground group-open:block">Sluiten</span>
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
