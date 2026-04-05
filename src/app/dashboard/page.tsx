"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import {
  Eye,
  MousePointerClick,
  Euro,
  Target,
  Image,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
  MessageSquare,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────
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

// ── Channel colors (match Desk) ────────────────────────────────
const CHANNEL_CONFIG: Record<string, { dot: string; color: string }> = {
  meta: { dot: "bg-blue-500", color: "#3b82f6" },
  google_ads: { dot: "bg-yellow-500", color: "#eab308" },
  linkedin: { dot: "bg-sky-500", color: "#0ea5e9" },
  dv360: { dot: "bg-emerald-500", color: "#10b981" },
  email: { dot: "bg-violet-500", color: "#8b5cf6" },
};

// ── Formatters ─────────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("nl-NL");
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

// ── Entry ──────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <AuthGuard>
      {(user, client) => <DashboardContent clientName={client?.name || ""} />}
    </AuthGuard>
  );
}

// ── KPI Card (matches Desk style) ──────────────────────────────
function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ElementType;
  trend?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-card-hover">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? "text-success" : "text-danger"}`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ── Performance Trend (ComposedChart — matches Desk) ───────────
function PerformanceTrendChart({ data }: { data: DashboardData["trend"] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Geen data beschikbaar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          yAxisId="spend"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `€${fmtCompact(v)}`}
        />
        <YAxis
          yAxisId="clicks"
          orientation="right"
          tick={{ fontSize: 11, fill: "var(--muted)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtCompact(v)}
        />
        <RechartsTooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--foreground)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          formatter={(value: unknown, name: unknown) => {
            const v = Number(value) || 0;
            if (name === "cost") return [fmtEur(v), "Investering"];
            return [fmtNum(v), "Klikken"];
          }}
          labelFormatter={(label: unknown) => {
            const d = new Date(String(label));
            return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
          }}
        />
        <Bar
          yAxisId="spend"
          dataKey="cost"
          fill="var(--border)"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
          name="cost"
        />
        <Line
          yAxisId="clicks"
          type="monotone"
          dataKey="clicks"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: "var(--accent)" }}
          name="clicks"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Channel Spend Donut (matches Desk) ─────────────────────────
function ChannelSpendDonut({ channels }: { channels: DashboardData["channels"] }) {
  const data = channels
    .filter((ch) => ch.cost > 0)
    .map((ch) => ({
      name: ch.label,
      value: ch.cost,
      color: CHANNEL_CONFIG[ch.source]?.color ?? "#71717a",
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Geen spend data
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex h-[260px] flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={72}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--foreground)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value: unknown) => [fmtEur(Number(value) || 0), "Investering"]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] text-muted-foreground">
              {entry.name}
              <span className="ml-1 font-medium text-foreground">
                {((entry.value / total) * 100).toFixed(0)}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget wrapper (matches Desk) ──────────────────────────────
function Widget({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card ${className}`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Report type ───────────────────────────────────────────────
interface Report {
  id: string;
  type: "weekly_report" | "monthly_report";
  title: string;
  body: string;
  created_at: string;
}

// ── Main Dashboard Content ─────────────────────────────────────
function DashboardContent({ clientName }: { clientName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      portalFetch<DashboardData>(`/dashboard?days=${period}`),
      portalFetch<{ reports: Report[] }>("/reports").catch(() => ({ reports: [] })),
    ])
      .then(([dashData, reportData]) => {
        setData(dashData);
        setReports(reportData.reports);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data?.kpis) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Welkom, {clientName}!</h2>
        <p className="text-muted-foreground">{data?.message || "Er is nog geen campagnedata beschikbaar."}</p>
      </div>
    );
  }

  const kpis = data.kpis;

  // Calculate simple trend (compare first half vs second half of period)
  function calcTrend(field: keyof DashboardData["trend"][0]): number | undefined {
    if (!data || data.trend.length < 4) return undefined;
    const mid = Math.floor(data.trend.length / 2);
    const first = data.trend.slice(0, mid).reduce((s, d) => s + (Number(d[field]) || 0), 0);
    const second = data.trend.slice(mid).reduce((s, d) => s + (Number(d[field]) || 0), 0);
    if (first === 0) return undefined;
    return ((second - first) / first) * 100;
  }

  return (
    <div>
      {/* Header + period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Overzicht</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Campagneresultaten van de afgelopen {period} dagen
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                period === d
                  ? "bg-accent text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-card-hover"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Action Cards (pending approvals / budgets) */}
      {(data.pendingApprovals > 0 || data.pendingBudgets > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {data.pendingApprovals > 0 && (
            <a
              href="/dashboard/approvals"
              className="flex items-center gap-4 p-4 bg-warning-light border border-warning/20 rounded-xl hover:border-warning/40 transition group"
            >
              <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                <Image className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{data.pendingApprovals} goedkeuring{data.pendingApprovals !== 1 ? "en" : ""} wacht{data.pendingApprovals === 1 ? "" : "en"}</p>
                <p className="text-sm text-muted-foreground">Bekijk en keur creatives goed</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-muted group-hover:text-foreground transition flex-shrink-0" />
            </a>
          )}
          {data.pendingBudgets > 0 && (
            <a
              href="/dashboard/budget"
              className="flex items-center gap-4 p-4 bg-accent-light border border-accent/20 rounded-xl hover:border-accent/40 transition group"
            >
              <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{data.pendingBudgets} budgetvoorstel{data.pendingBudgets !== 1 ? "len" : ""}</p>
                <p className="text-sm text-muted-foreground">Bekijk en keur budgetwijzigingen goed</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-muted group-hover:text-foreground transition flex-shrink-0" />
            </a>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Weergaven"
          value={fmtNum(kpis.impressions)}
          sublabel="Aantal keer getoond"
          icon={Eye}
          trend={calcTrend("impressions")}
        />
        <KpiCard
          label="Klikken"
          value={fmtNum(kpis.clicks)}
          sublabel={`${kpis.ctr}% klikpercentage`}
          icon={MousePointerClick}
          trend={calcTrend("clicks")}
        />
        <KpiCard
          label="Investering"
          value={fmtEur(kpis.cost)}
          sublabel={`${kpis.cpc} per klik`}
          icon={Euro}
          trend={calcTrend("cost")}
        />
        <KpiCard
          label="Resultaten"
          value={fmtNum(kpis.conversions)}
          sublabel={`${kpis.cpa} per resultaat`}
          icon={Target}
          trend={calcTrend("conversions")}
        />
      </div>

      {/* Charts row: Performance Trend + Channel Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        <Widget title="Dagelijks verloop" className="lg:col-span-2">
          <PerformanceTrendChart data={data.trend} />
        </Widget>
        <Widget title="Verdeling per kanaal">
          <ChannelSpendDonut channels={data.channels} />
        </Widget>
      </div>

      {/* Channel Breakdown Table */}
      {data.channels.length > 0 && (
        <Widget title="Per kanaal">
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="px-4 py-2.5 font-medium">Kanaal</th>
                  <th className="px-4 py-2.5 font-medium text-right">Weergaven</th>
                  <th className="px-4 py-2.5 font-medium text-right">Klikken</th>
                  <th className="px-4 py-2.5 font-medium text-right">Investering</th>
                  <th className="px-4 py-2.5 font-medium text-right">Resultaten</th>
                  <th className="px-4 py-2.5 font-medium text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {data.channels.map((ch) => {
                  const cfg = CHANNEL_CONFIG[ch.source];
                  return (
                    <tr key={ch.source} className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${cfg?.dot ?? "bg-zinc-500"}`} />
                          <span className="font-medium">{ch.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtNum(ch.impressions)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtNum(ch.clicks)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtEur(ch.cost)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmtNum(ch.conversions)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{ch.ctr}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Widget>
      )}

      {/* Rapportages */}
      {reports.length > 0 && (
        <Widget title="Rapportages" className="mt-6">
          <div className="space-y-3">
            {reports.map((report) => {
              const isExpanded = expandedReport === report.id;
              const date = new Date(report.created_at);
              const dateStr = date.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
              const isMonthly = report.type === "monthly_report";

              return (
                <div key={report.id} className="border border-border-subtle rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-card-hover transition text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isMonthly ? "bg-accent/10" : "bg-emerald-500/10"
                    }`}>
                      {isMonthly
                        ? <Calendar className="w-4 h-4 text-accent" />
                        : <FileText className="w-4 h-4 text-emerald-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{report.title}</p>
                      <p className="text-xs text-muted-foreground">{dateStr}</p>
                    </div>
                    <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      isMonthly
                        ? "bg-accent/10 text-accent"
                        : "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {isMonthly ? "Maand" : "Week"}
                    </span>
                    <ArrowUpRight className={`w-4 h-4 text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border-subtle">
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap mt-3 leading-relaxed font-sans">
                        {report.body}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Widget>
      )}

      {/* Community Feedback (Beta) — placeholder */}
      <div className="mt-6 rounded-lg border border-dashed border-border bg-card/50 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Community Feedback
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500">
                Beta
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">Binnenkort beschikbaar</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          We werken aan een nieuwe functie die reacties op je advertenties automatisch analyseert.
          Je ziet straks in één overzicht hoe je doelgroep reageert op je campagnes — van positieve
          feedback tot aandachtspunten. Zo houd je de vinger aan de pols.
        </p>
      </div>
    </div>
  );
}
