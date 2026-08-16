"use client";

/**
 * /dashboard/creator — Casey's channel dashboard (D-021, English).
 *
 * Same data, same math as the internal Desk screen: everything comes from
 * the shared insights layer in the Hub (/api/portal/creator/*), client
 * scope hard-locked in the portal token. Reading order mirrors the plan:
 * what's worth knowing, the four numbers deals are priced on, then every
 * video against your own normal. Shorts and long-form are never summed:
 * since 31 March 2025 a Shorts view counts every start or replay and is a
 * different unit than a long-form view.
 */

import { useEffect, useMemo, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { portalFetch } from "@/lib/api";

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

const fmt = (n: number | null | undefined) => (n == null ? "-" : Number(n).toLocaleString("en-US"));

function lengthLabel(cls: string | null): string {
  if (cls === "kort") return "short (<3m)";
  if (cls === "middel") return "mid (3-10m)";
  if (cls === "lang") return "long (10m+)";
  return "-";
}

function RetentionChart({ curve }: { curve: RetentionResponse["curve"] }) {
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
      <text x={PAD} y={H - 8} fontSize="9" fill="currentColor" className="text-muted">start</text>
      <text x={W - PAD} y={H - 8} fontSize="9" fill="currentColor" textAnchor="end" className="text-muted">end of video</text>
      <text x={4} y={PAD + 4} fontSize="9" fill="currentColor" className="text-muted">{Math.round(maxY * 100)}%</text>
    </svg>
  );
}

function VideoTable({
  label,
  rows,
  expanded,
  onToggle,
  retention,
  retentionLoading,
}: {
  label: string;
  rows: VideoRow[];
  expanded: string | null;
  onToggle: (id: string) => void;
  retention: RetentionResponse | null;
  retentionLoading: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-semibold mb-2">
        {label} <span className="text-muted font-normal">({rows.length})</span>
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No {label.toLowerCase()} in this window.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-border">
                <th className="py-2 pr-3">Video</th>
                <th className="py-2 pr-3">Length</th>
                <th className="py-2 pr-3">Age</th>
                <th className="py-2 pr-3 text-right">Views</th>
                <th className="py-2 pr-3 text-right">Multiplier</th>
                <th className="py-2 pr-3 text-right">Retention</th>
                <th className="py-2 text-right">Subs /1,000 views</th>
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
                            "no image"
                          )}
                        </span>
                        <span className="truncate max-w-[260px]">{v.title || v.content_id}</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{lengthLabel(v.length_class)}</td>
                    <td className="py-2 pr-3">{v.age_days}d</td>
                    <td className="py-2 pr-3 text-right">{fmt(v.views)}</td>
                    <td className="py-2 pr-3 text-right font-semibold" title={v.views_multiplier == null ? "Needs at least 5 videos in this length class" : "Views per day vs the median within format and length class"}>
                      {v.views_multiplier != null ? `${v.views_multiplier}x` : "-"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {v.avg_view_percentage != null ? `${Math.round(Number(v.avg_view_percentage) * 10) / 10}%` : "-"}
                      {v.retention_vs_median != null && (
                        <span className="text-muted"> ({v.retention_vs_median >= 0 ? "+" : ""}{v.retention_vs_median}pt)</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {v.subs_per_1000_views != null ? fmt(v.subs_per_1000_views) : "-"}
                      {v.subscribers_gained != null && <span className="text-muted font-normal"> (+{fmt(v.subscribers_gained)})</span>}
                    </td>
                  </tr>
                  {expanded === v.content_id && (
                    <tr key={`${v.content_id}-detail`} className="border-b border-border-subtle">
                      <td colSpan={7} className="py-3 px-2 bg-card/60">
                        {retentionLoading ? (
                          <p className="text-sm text-muted">Loading retention curve...</p>
                        ) : retention && retention.curve.length > 1 ? (
                          <div className="max-w-xl">
                            <RetentionChart curve={retention.curve} />
                            <p className="text-xs text-muted mt-1.5">
                              Audience retention, measured {retention.measured_on ? new Date(retention.measured_on).toLocaleDateString("en-GB") : "-"}.
                              Above 100% at the start means people rewatch the opening. The dashed line is 100%.
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted">
                            No retention measurement yet for this video. Measuring rhythm: your latest 20 videos weekly, every video at day 7 and day 30.
                          </p>
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

  if (loading) return <p className="text-sm text-muted p-6">Loading your channel...</p>;

  return (
    <div className="space-y-6 p-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Your channel</h1>
          <p className="text-sm text-muted mt-1">
            Your numbers against your own normal. Data comes from the YouTube Analytics API, which runs 48 to 72 hours behind.
          </p>
        </div>
        {summary?.sync && (
          <span className={`text-xs px-2.5 py-1 rounded-full ${summary.sync.fresh ? "bg-accent-light text-accent" : "bg-danger-light text-danger"}`}>
            {summary.sync.fresh ? "Data up to date" : "Data may be stale"}
          </span>
        )}
      </div>

      {/* What's worth knowing */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-3">Worth knowing</h2>
        {signals.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing stands out right now. We only flag what deviates from your own normal, so quiet is fine.
          </p>
        ) : (
          <div className="space-y-2">
            {signals.slice(0, 5).map((sig) => (
              <details key={sig.id}>
                <summary className="cursor-pointer text-sm font-semibold">
                  {sig.headline || sig.title}
                  <span className="text-muted font-normal text-xs ml-2">
                    {new Date(sig.created_at_source).toLocaleDateString("en-GB")}
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
            label: "Median views, long-form",
            value: med?.video?.median_lifetime_views_30_90d != null ? fmt(med.video.median_lifetime_views_30_90d) : "Not measured yet",
            hint: med?.video?.median_lifetime_views_30_90d != null
              ? `Lifetime views of videos 30-90 days old (${med.video.sample_30_90d} videos).`
              : `Needs at least 5 long-form videos aged 30-90 days; currently ${med?.video?.sample_30_90d ?? 0}.`,
          },
          {
            label: "Median views, Shorts",
            value: med?.short?.median_lifetime_views_30_90d != null ? fmt(med.short.median_lifetime_views_30_90d) : "Not measured yet",
            hint: med?.short?.median_lifetime_views_30_90d != null
              ? `Lifetime views of Shorts 30-90 days old (${med.short.sample_30_90d} Shorts). Never added to long-form.`
              : `Needs at least 5 Shorts aged 30-90 days; currently ${med?.short?.sample_30_90d ?? 0}.`,
          },
          {
            label: "Subscribers per 1,000 views (90d)",
            value: med?.video?.subs_per_1000_views_90d != null ? fmt(med.video.subs_per_1000_views_90d) : "Not measured yet",
            hint: `Long-form. Shorts: ${med?.short?.subs_per_1000_views_90d != null ? fmt(med.short.subs_per_1000_views_90d) : "not measured yet"}.`,
          },
          {
            label: "Clicks to shop or sponsor",
            value: "Not measured yet",
            hint: "Needs a tracked shortlink per video; that layer is coming.",
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
        Shorts and long-form are never added together: since 31 March 2025 a Shorts view counts every start or replay, a different unit than a long-form view.
        {summary?.kpis?.subscribers != null && (
          <> Channel: {fmt(summary.kpis.subscribers)} subscribers, {summary.kpis.net_subscriber_change >= 0 ? "+" : ""}{fmt(summary.kpis.net_subscriber_change)} in {summary.days} days.</>
        )}
      </p>

      {/* Every video against your own normal */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
        <div>
          <h2 className="text-sm font-semibold">What did what, against your own normal</h2>
          <p className="text-xs text-muted mt-1">
            Last 90 days, sorted by subscribers gained. The multiplier compares views per day with the median within the same format and length class. Click a row for the retention curve.
          </p>
        </div>
        {videos.length === 0 ? (
          <p className="text-sm text-muted">No videos in this window yet.</p>
        ) : (
          <>
            <VideoTable label="Long-form" rows={longForm} expanded={expanded} onToggle={(id) => setExpanded(expanded === id ? null : id)} retention={retention} retentionLoading={retentionLoading} />
            <VideoTable label="Shorts" rows={shorts} expanded={expanded} onToggle={(id) => setExpanded(expanded === id ? null : id)} retention={retention} retentionLoading={retentionLoading} />
            <p className="text-xs text-muted">
              An empty multiplier means fewer than {videosRes?.min_class_sample ?? 5} videos in that length class; there is no median to compare against. Retention is the average percentage watched, with the difference from the class median in points.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

export default function CreatorPage() {
  return <AuthGuard>{() => <CreatorContent />}</AuthGuard>;
}
