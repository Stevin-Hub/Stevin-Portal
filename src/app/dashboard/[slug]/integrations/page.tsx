"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Icon, addCollection } from "@iconify/react";
import simpleIconsData from "@iconify-json/simple-icons/icons.json";

// Register simple-icons offline so we don't depend on api.iconify.design (CSP-blocked + slow).
// Pulled in once at module load — cheap because Iconify only stores raw paths.
addCollection(simpleIconsData);
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
  iconName: string; // simple-icons reference, e.g. "simple-icons:meta"
  iconColor: string; // brand colour as hex
  enabled: boolean;
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: "meta",
    name: "Meta (Facebook + Instagram)",
    description: "Advertentiedata, campagne-statistieken en pagina-inzichten van Meta Business Manager.",
    iconName: "simple-icons:facebook",
    iconColor: "#1877F2",
    enabled: true,
  },
  {
    id: "google_ads",
    name: "Google Ads",
    description: "Campagne-data, zoekwoord-prestaties en kosten uit Google Ads.",
    iconName: "simple-icons:googleads",
    iconColor: "#4285F4",
    enabled: true,
  },
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    description: "Bezoekers, conversies en gebeurtenissen uit GA4.",
    iconName: "simple-icons:googleanalytics",
    iconColor: "#E37400",
    enabled: true,
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    description: "Organische zoekprestaties, klikken, vertoningen en posities.",
    iconName: "simple-icons:googlesearchconsole",
    iconColor: "#458CF5",
    enabled: true,
  },
  {
    id: "google_tag_manager",
    name: "Google Tag Manager",
    description: "Tag-configuratie en event-firing voor je site, zodat we kunnen zien welke conversies tellen.",
    iconName: "simple-icons:googletagmanager",
    iconColor: "#246FDB",
    enabled: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Advertentiedata en pagina-inzichten van LinkedIn.",
    iconName: "simple-icons:linkedin",
    iconColor: "#0A66C2",
    enabled: true,
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Advertentiedata en pagina-inzichten van TikTok.",
    iconName: "simple-icons:tiktok",
    iconColor: "#000000",
    enabled: true,
  },
  {
    id: "x",
    name: "X (Twitter)",
    description: "Advertentiedata en post-inzichten van X Ads.",
    iconName: "simple-icons:x",
    iconColor: "#000000",
    enabled: true,
  },
  {
    id: "snapchat",
    name: "Snapchat",
    description: "Advertentiedata en campagne-statistieken van Snapchat Ads Manager.",
    iconName: "simple-icons:snapchat",
    iconColor: "#FFFC00",
    enabled: true,
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    description: "Contacten, deals en lifecycle-stages uit HubSpot voor lead-attributie.",
    iconName: "simple-icons:hubspot",
    iconColor: "#FF7A59",
    enabled: false,
  },
  {
    id: "teamleader",
    name: "Teamleader CRM",
    description: "Contacten, deals en activiteiten uit Teamleader Focus voor lead-attributie.",
    iconName: "simple-icons:hubspot", // simple-icons heeft geen teamleader; placeholder, vervangen na deploy
    iconColor: "#FFD400",
    enabled: false,
  },
  {
    id: "pipedrive",
    name: "Pipedrive CRM",
    description: "Deals, activiteiten en pipeline-fases uit Pipedrive.",
    iconName: "simple-icons:hubspot", // simple-icons heeft geen pipedrive; placeholder, vervangen na deploy
    iconColor: "#1A1A1A",
    enabled: false,
  },
  {
    id: "salesforce",
    name: "Salesforce CRM",
    description: "Leads, opportunities en pipeline-data uit Salesforce voor sales-attributie.",
    iconName: "simple-icons:salesforce",
    iconColor: "#00A1E0",
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
  {
    id: "other_crm",
    title: "Andere CRM",
    description: "Gebruik je een CRM die hierboven niet staat? Stuur een mail met de naam, dan koppelen we 'm in 1-2 werkdagen.",
    examples: "Salesforce, Zoho, Microsoft Dynamics, ActiveCampaign, eigen systeem",
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
        <div className="bg-white border border-border w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon icon={platform.iconName} width={24} height={24} style={{ color: platform.iconColor }} />
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
