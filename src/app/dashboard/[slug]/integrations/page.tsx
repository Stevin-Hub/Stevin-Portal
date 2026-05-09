"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { isLoggedIn, getClient } from "@/lib/auth";
import { portalFetch } from "@/lib/api";
import { toast } from "sonner";

type ConnectionStatus = "not_connected" | "connected" | "broken";

interface Connection {
  platform: string;
  status: ConnectionStatus;
  token_expiry?: string | null;
  granted_by_role?: string | null;
  last_successful_sync_at?: string | null;
  connected_at?: string | null;
  auth_failure_at?: string | null;
  consecutive_failure_count?: number;
}

interface PlatformMeta {
  id: string;
  name: string;
  description: string;
  iconBg: string;
  Icon: React.FC<{ className?: string }>;
  enabled: boolean;
}

// ── Brand SVG icons (paths from simple-icons, CC0) ──
const MetaIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06c0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
  </svg>
);
const GoogleAdsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#FBBC04" d="m7.4 2.55 7.07 12.24-4.4 2.55L3 5.1z" />
    <path fill="#4285F4" d="M14.47 14.79 7.4 2.55 12 0l7.07 12.24z" />
    <circle fill="#34A853" cx="6.4" cy="20.95" r="2.55" />
    <path fill="#34A853" d="M19.07 12.24 12 24l4.4 2.55c.96-1.66 6.65-11.55 6.65-11.55l-4-2.76z" transform="translate(0 -3)" />
  </svg>
);
const GA4Icon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#F9AB00" d="M22.84 2.998v17.999a2.97 2.97 0 0 1-2.967 2.998 2.97 2.97 0 0 1-2.873-2.99V3.12C16.943 1.49 18.155.34 19.756.34c1.59 0 2.961 1.197 3.084 2.658z" />
    <path fill="#E37400" d="M15.07 12c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm-7-9c-1.66 0-3 1.34-3 3v15c0 1.66 1.34 3 3 3s3-1.34 3-3V6c0-1.66-1.34-3-3-3z" opacity=".55" />
  </svg>
);
const GSCIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#34A853" d="M21.7 20.3 17 15.6a8 8 0 1 0-1.4 1.4l4.7 4.7a1 1 0 0 0 1.4-1.4zM10 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
    <circle fill="#4285F4" cx="10" cy="10" r="4" />
  </svg>
);
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
  </svg>
);
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.69a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.12z" />
  </svg>
);

const PLATFORMS: PlatformMeta[] = [
  {
    id: "meta",
    name: "Meta (Facebook + Instagram)",
    description: "Advertentiedata, campagne-statistieken en pagina-inzichten van Meta Business Manager.",
    iconBg: "bg-[#1877F2] text-white",
    Icon: MetaIcon,
    enabled: true,
  },
  {
    id: "google_ads",
    name: "Google Ads",
    description: "Campagne-data, zoekwoord-prestaties en kosten uit Google Ads.",
    iconBg: "bg-white border border-border",
    Icon: GoogleAdsIcon,
    enabled: false, // toegevoegd in volgende ronde
  },
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    description: "Bezoekers, conversies en gebeurtenissen uit GA4.",
    iconBg: "bg-white border border-border",
    Icon: GA4Icon,
    enabled: false,
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    description: "Organische zoekprestaties, klikken, vertoningen en posities.",
    iconBg: "bg-white border border-border",
    Icon: GSCIcon,
    enabled: false,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Advertentiedata en pagina-inzichten van LinkedIn.",
    iconBg: "bg-[#0A66C2] text-white",
    Icon: LinkedInIcon,
    enabled: false,
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Advertentiedata en pagina-inzichten van TikTok.",
    iconBg: "bg-black text-white",
    Icon: TikTokIcon,
    enabled: false,
  },
];

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";

  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);

  // Slug + login guard
  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    const client = getClient();
    if (!client || client.slug !== slug) {
      setAuthState("denied");
      return;
    }
    setAuthState("ok");
  }, [slug, router]);

  // Read OAuth callback toasts (?platform=meta&connected=1 / ?error=...)
  useEffect(() => {
    const platform = searchParams.get("platform");
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    if (connected === "1" && platform) {
      toast.success(`${labelFor(platform)} gekoppeld.`);
    } else if (err) {
      toast.error(`Koppelen mislukt: ${humanError(err)}`);
    }
  }, [searchParams]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await portalFetch<{ connections: Connection[] }>("/connect/status");
      setConnections(data.connections);
    } catch (e: any) {
      toast.error(`Status laden mislukt: ${e.message || "onbekende fout"}`);
    }
  }, []);

  useEffect(() => {
    if (authState === "ok") fetchStatus();
  }, [authState, fetchStatus]);

  async function handleConnect(platformId: string) {
    setLoadingPlatform(platformId);
    try {
      const data = await portalFetch<{ url: string }>(`/connect/${platformId}/url`);
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(`Kon koppeling niet starten: ${e.message || "onbekende fout"}`);
      setLoadingPlatform(null);
    }
  }

  if (authState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (authState === "denied") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h1 className="text-xl font-bold mb-2">Geen toegang</h1>
        <p className="text-muted-foreground mb-6">Log in met het juiste account.</p>
        <a href="/login" className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition">
          Inloggen
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Koppelingen</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
          Koppel je advertentie- en analytics-accounts aan Stevin. We slaan alleen de toegangscodes op die nodig zijn om je
          campagne-data te lezen, geen wachtwoorden. Een koppeling kun je op elk moment intrekken vanuit het platform zelf.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLATFORMS.map((p) => {
          const conn = connections.find((c) => c.platform === p.id);
          const status: ConnectionStatus = conn?.status || "not_connected";
          return (
            <PlatformCard
              key={p.id}
              platform={p}
              status={status}
              connection={conn}
              isLoading={loadingPlatform === p.id}
              onConnect={() => handleConnect(p.id)}
            />
          );
        })}
      </div>

      <ManualConnectionsSection />
    </div>
  );
}

// ── Manual API-key sections (e-mail tool + ticketing) ──────────
const MANUAL_PLATFORMS = [
  {
    id: "email",
    title: "E-mail marketing tool",
    description: "MailChimp, Mailblue, Spotler, Brevo, Klaviyo of iets anders. We gebruiken een read-only API-key om openings, kliks en uitschrijvingen te lezen.",
    examples: "Mailblue, MailChimp, Spotler",
  },
  {
    id: "ticketing",
    title: "Ticketing of booking",
    description: "FooEvents, Eventix, CM, Tixly, een eigen WordPress-plugin. We lezen alleen verkoopdata, geen klantgegevens.",
    examples: "FooEvents, Eventix, Tixly",
  },
];

function ManualConnectionsSection() {
  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h2 className="text-lg font-semibold mb-2">Niet via een knop</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
        Twee soorten tools koppelen we handmatig met een API-key: je e-mail-marketing-systeem en je ticketing- of
        bookingplatform. Daarvoor sturen we je een korte instructie en activeren we de koppeling namens jou.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MANUAL_PLATFORMS.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
            <h3 className="font-semibold text-base">{p.title}</h3>
            <p className="text-xs text-muted-foreground leading-snug">{p.description}</p>
            <p className="text-xs text-muted-foreground">Bijvoorbeeld: {p.examples}</p>
            <a
              href={`mailto:koen@stevin.ai?subject=API-key%20${encodeURIComponent(p.title)}`}
              className="mt-auto px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-lg hover:bg-muted transition text-center"
            >
              Stuur ons een mail
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformCard({
  platform,
  status,
  connection,
  isLoading,
  onConnect,
}: {
  platform: PlatformMeta;
  status: ConnectionStatus;
  connection: Connection | undefined;
  isLoading: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className={`${platform.iconBg} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <platform.Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight">{platform.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{platform.description}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === "connected" && connection?.connected_at && (
        <p className="text-xs text-muted-foreground">
          Gekoppeld op {formatDate(connection.connected_at)}
          {connection.last_successful_sync_at ? ` · Laatste sync ${formatRelative(connection.last_successful_sync_at)}` : ""}
        </p>
      )}

      {status === "broken" && connection?.auth_failure_at && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Koppeling werkt niet meer sinds {formatDate(connection.auth_failure_at)}
          {connection.consecutive_failure_count && connection.consecutive_failure_count > 1
            ? ` (${connection.consecutive_failure_count} mislukte syncs)`
            : ""}
        </p>
      )}

      <div className="flex gap-2 mt-auto">
        {!platform.enabled ? (
          <button
            disabled
            className="flex-1 px-4 py-2 text-sm font-medium bg-muted text-muted-foreground rounded-lg cursor-not-allowed opacity-60"
          >
            Binnenkort
          </button>
        ) : status === "connected" ? (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-lg hover:bg-muted transition disabled:opacity-60"
          >
            {isLoading ? "Bezig..." : "Opnieuw koppelen"}
          </button>
        ) : status === "broken" ? (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-60"
          >
            {isLoading ? "Bezig..." : "Opnieuw verbinden"}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-muted transition disabled:opacity-60"
          >
            {isLoading ? "Bezig..." : "Verbinden"}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Verbonden</span>;
  }
  if (status === "broken") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Verbroken</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Niet verbonden</span>;
}

// ── Helpers ──

function labelFor(platformId: string): string {
  const p = PLATFORMS.find((x) => x.id === platformId);
  return p?.name || platformId;
}

function humanError(code: string): string {
  switch (code) {
    case "meta_denied":
    case "denied":
      return "je hebt de toegang geweigerd";
    case "state_expired":
      return "de koppel-link is verlopen, probeer opnieuw";
    case "token_exchange_failed":
    case "long_token_failed":
      return "het uitwisselen van de toegangscode lukte niet";
    case "invalid_callback":
      return "ongeldige callback van het platform";
    case "server_error":
      return "interne fout, probeer later opnieuw";
    default:
      return code;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} min geleden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}u geleden`;
    const days = Math.floor(hours / 24);
    return `${days}d geleden`;
  } catch {
    return iso;
  }
}
