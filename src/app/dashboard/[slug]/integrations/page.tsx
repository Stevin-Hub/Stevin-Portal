"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Icon, addCollection } from "@iconify/react";
import simpleIconsData from "@iconify-json/simple-icons/icons.json";

// Register simple-icons offline so we don't depend on api.iconify.design (CSP-blocked + slow).
// Pulled in once at module load, cheap because Iconify only stores raw paths.
addCollection(simpleIconsData);
import { isLoggedIn, getClient } from "@/lib/auth";
import { portalFetch } from "@/lib/api";
import { useLanguage, localeFor, type Lang } from "@/lib/useLanguage";
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
  iconName: string; // simple-icons reference, e.g. "simple-icons:meta"
  iconColor: string; // brand colour as hex
  enabled: boolean;
}

// Merknamen en iconen zijn taal-onafhankelijk; de omschrijving komt uit COPY.
const PLATFORMS: PlatformMeta[] = [
  {
    id: "meta",
    name: "Meta (Facebook + Instagram)",
    iconName: "simple-icons:facebook",
    iconColor: "#1877F2",
    enabled: true,
  },
  {
    id: "google_ads",
    name: "Google Ads",
    iconName: "simple-icons:googleads",
    iconColor: "#4285F4",
    enabled: true,
  },
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    iconName: "simple-icons:googleanalytics",
    iconColor: "#E37400",
    enabled: true,
  },
  {
    id: "google_search_console",
    name: "Google Search Console",
    iconName: "simple-icons:googlesearchconsole",
    iconColor: "#458CF5",
    enabled: true,
  },
  {
    id: "google_tag_manager",
    name: "Google Tag Manager",
    iconName: "simple-icons:googletagmanager",
    iconColor: "#246FDB",
    enabled: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    iconName: "simple-icons:linkedin",
    iconColor: "#0A66C2",
    enabled: true,
  },
  {
    id: "tiktok",
    name: "TikTok",
    iconName: "simple-icons:tiktok",
    iconColor: "#000000",
    enabled: false, // TIKTOK_APP_ID ontbreekt op server, tijdelijk uitgeschakeld
  },
  {
    id: "x",
    name: "X (Twitter)",
    iconName: "simple-icons:x",
    iconColor: "#000000",
    enabled: true,
  },
  {
    id: "snapchat",
    name: "Snapchat",
    iconName: "simple-icons:snapchat",
    iconColor: "#FFFC00",
    enabled: true,
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    iconName: "simple-icons:hubspot",
    iconColor: "#FF7A59",
    enabled: false,
  },
  {
    id: "teamleader",
    name: "Teamleader CRM",
    iconName: "simple-icons:hubspot", // simple-icons heeft geen teamleader; placeholder, vervangen na deploy
    iconColor: "#FFD400",
    enabled: false,
  },
  {
    id: "pipedrive",
    name: "Pipedrive CRM",
    iconName: "simple-icons:hubspot", // simple-icons heeft geen pipedrive; placeholder, vervangen na deploy
    iconColor: "#1A1A1A",
    enabled: false,
  },
  {
    id: "salesforce",
    name: "Salesforce CRM",
    iconName: "simple-icons:salesforce",
    iconColor: "#00A1E0",
    enabled: false,
  },
];

// Twee soorten tools koppelen we handmatig; alleen de id's staan hier, de tekst zit in COPY.
const MANUAL_PLATFORM_IDS = ["email", "ticketing", "other_crm"];

interface ManualCopy {
  title: string;
  description: string;
  examples: string;
}

interface Copy {
  platformDescriptions: Record<string, string>;
  connectedToast: (name: string) => string;
  connectFailed: (reason: string) => string;
  statusLoadFailed: (reason: string) => string;
  connectStartFailed: (reason: string) => string;
  unknownError: string;
  activatedByStevin: string;
  noAccessTitle: string;
  noAccessBody: string;
  login: string;
  pageTitle: string;
  pageIntro: string;
  connectedOn: (date: string) => string;
  lastSync: (relative: string) => string;
  brokenSince: (date: string) => string;
  failedSyncs: (count: number) => string;
  comingSoon: string;
  connectedButton: string;
  letStevinRepair: string;
  viaStevin: string;
  busy: string;
  connectAgain: string;
  reconnect: string;
  connect: string;
  badgeConnected: string;
  badgeBroken: string;
  badgeNotConnected: string;
  manualTitle: string;
  manualIntro: string;
  manual: Record<string, ManualCopy>;
  forExample: (examples: string) => string;
  mailUs: string;
  errors: Record<string, string>;
  minutesAgo: (value: number) => string;
  hoursAgo: (value: number) => string;
  daysAgo: (value: number) => string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    platformDescriptions: {
      meta: "Advertentiedata, campagne-statistieken en pagina-inzichten van Meta Business Manager.",
      google_ads: "Campagne-data, zoekwoord-prestaties en kosten uit Google Ads.",
      google_analytics: "Bezoekers, conversies en gebeurtenissen uit GA4.",
      google_search_console: "Organische zoekprestaties, klikken, vertoningen en posities.",
      google_tag_manager: "Tag-configuratie en event-firing voor je site, zodat we kunnen zien welke conversies tellen.",
      linkedin: "Advertentiedata en pagina-inzichten van LinkedIn.",
      tiktok: "Advertentiedata en pagina-inzichten van TikTok.",
      x: "Advertentiedata en post-inzichten van X Ads.",
      snapchat: "Advertentiedata en campagne-statistieken van Snapchat Ads Manager.",
      hubspot: "Contacten, deals en lifecycle-stages uit HubSpot voor lead-attributie.",
      teamleader: "Contacten, deals en activiteiten uit Teamleader Focus voor lead-attributie.",
      pipedrive: "Deals, activiteiten en pipeline-fases uit Pipedrive.",
      salesforce: "Leads, opportunities en pipeline-data uit Salesforce voor sales-attributie.",
    },
    connectedToast: (name) => `${name} gekoppeld.`,
    connectFailed: (reason) => `Koppelen mislukt: ${reason}`,
    statusLoadFailed: (reason) => `Status laden mislukt: ${reason}`,
    connectStartFailed: (reason) => `Kon koppeling niet starten: ${reason}`,
    unknownError: "onbekende fout",
    activatedByStevin: "Stevin activeert deze koppeling samen met je team.",
    noAccessTitle: "Geen toegang",
    noAccessBody: "Log in met het juiste account.",
    login: "Inloggen",
    pageTitle: "Koppelingen",
    pageIntro:
      "Stevin activeert advertentie- en analytics-koppelingen samen met je team. Zo voorkomen we dat je op technische Google- of Meta-schermen terechtkomt tijdens de onboarding.",
    connectedOn: (date) => `Gekoppeld op ${date}`,
    lastSync: (relative) => ` · Laatste sync ${relative}`,
    brokenSince: (date) => `Koppeling werkt niet meer sinds ${date}`,
    failedSyncs: (count) => ` (${count} mislukte syncs)`,
    comingSoon: "Binnenkort",
    connectedButton: "Gekoppeld",
    letStevinRepair: "Laat Stevin herstellen",
    viaStevin: "Via Stevin",
    busy: "Bezig...",
    connectAgain: "Opnieuw koppelen",
    reconnect: "Opnieuw verbinden",
    connect: "Verbinden",
    badgeConnected: "Verbonden",
    badgeBroken: "Verbroken",
    badgeNotConnected: "Niet verbonden",
    manualTitle: "Niet via een knop",
    manualIntro:
      "Twee soorten tools koppelen we handmatig met een API-key: je e-mail-marketing-systeem en je ticketing- of bookingplatform. Daarvoor sturen we je een korte instructie en activeren we de koppeling namens jou.",
    manual: {
      email: {
        title: "E-mail marketing tool",
        description:
          "MailChimp, Mailblue, Spotler, Brevo, Klaviyo of iets anders. We gebruiken een read-only API-key om openings, kliks en uitschrijvingen te lezen.",
        examples: "Mailblue, MailChimp, Spotler",
      },
      ticketing: {
        title: "Ticketing of booking",
        description:
          "FooEvents, Eventix, CM, Tixly, een eigen WordPress-plugin. We lezen alleen verkoopdata, geen klantgegevens.",
        examples: "FooEvents, Eventix, Tixly",
      },
      other_crm: {
        title: "Andere CRM",
        description:
          "Gebruik je een CRM die hierboven niet staat? Stuur een mail met de naam, dan koppelen we 'm in 1-2 werkdagen.",
        examples: "Salesforce, Zoho, Microsoft Dynamics, ActiveCampaign, eigen systeem",
      },
    },
    forExample: (examples) => `Bijvoorbeeld: ${examples}`,
    mailUs: "Stuur ons een mail",
    errors: {
      meta_denied: "je hebt de toegang geweigerd",
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
    minutesAgo: (value) => `${value} min geleden`,
    hoursAgo: (value) => `${value}u geleden`,
    daysAgo: (value) => `${value}d geleden`,
  },
  en: {
    platformDescriptions: {
      meta: "Ad data, campaign statistics and page insights from Meta Business Manager.",
      google_ads: "Campaign data, keyword performance and cost from Google Ads.",
      google_analytics: "Visitors, conversions and events from GA4.",
      google_search_console: "Organic search performance, clicks, impressions and positions.",
      google_tag_manager: "Tag configuration and event firing for your site, so we can see which conversions count.",
      linkedin: "Ad data and page insights from LinkedIn.",
      tiktok: "Ad data and page insights from TikTok.",
      x: "Ad data and post insights from X Ads.",
      snapchat: "Ad data and campaign statistics from Snapchat Ads Manager.",
      hubspot: "Contacts, deals and lifecycle stages from HubSpot for lead attribution.",
      teamleader: "Contacts, deals and activities from Teamleader Focus for lead attribution.",
      pipedrive: "Deals, activities and pipeline stages from Pipedrive.",
      salesforce: "Leads, opportunities and pipeline data from Salesforce for sales attribution.",
    },
    connectedToast: (name) => `${name} connected.`,
    connectFailed: (reason) => `Connecting failed: ${reason}`,
    statusLoadFailed: (reason) => `Loading the status failed: ${reason}`,
    connectStartFailed: (reason) => `Could not start the connection: ${reason}`,
    unknownError: "unknown error",
    activatedByStevin: "Stevin activates this connection together with your team.",
    noAccessTitle: "No access",
    noAccessBody: "Log in with the right account.",
    login: "Log in",
    pageTitle: "Connections",
    pageIntro:
      "Stevin activates advertising and analytics connections together with your team. That way you never end up on technical Google or Meta screens during onboarding.",
    connectedOn: (date) => `Connected on ${date}`,
    lastSync: (relative) => ` · Last sync ${relative}`,
    brokenSince: (date) => `Connection stopped working on ${date}`,
    failedSyncs: (count) => ` (${count} failed syncs)`,
    comingSoon: "Coming soon",
    connectedButton: "Connected",
    letStevinRepair: "Let Stevin repair it",
    viaStevin: "Via Stevin",
    busy: "Working...",
    connectAgain: "Connect again",
    reconnect: "Reconnect",
    connect: "Connect",
    badgeConnected: "Connected",
    badgeBroken: "Broken",
    badgeNotConnected: "Not connected",
    manualTitle: "Not through a button",
    manualIntro:
      "Two kinds of tools we connect by hand with an API key: your email marketing system and your ticketing or booking platform. We send you a short instruction and activate the connection on your behalf.",
    manual: {
      email: {
        title: "Email marketing tool",
        description:
          "MailChimp, Mailblue, Spotler, Brevo, Klaviyo or something else. We use a read-only API key to read opens, clicks and unsubscribes.",
        examples: "Mailblue, MailChimp, Spotler",
      },
      ticketing: {
        title: "Ticketing or booking",
        description:
          "FooEvents, Eventix, CM, Tixly, your own WordPress plugin. We only read sales data, no customer details.",
        examples: "FooEvents, Eventix, Tixly",
      },
      other_crm: {
        title: "Another CRM",
        description:
          "Using a CRM that is not listed above? Send us a mail with the name and we connect it within 1 to 2 working days.",
        examples: "Salesforce, Zoho, Microsoft Dynamics, ActiveCampaign, your own system",
      },
    },
    forExample: (examples) => `For example: ${examples}`,
    mailUs: "Send us a mail",
    errors: {
      meta_denied: "you denied access",
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
    minutesAgo: (value) => `${value} min ago`,
    hoursAgo: (value) => `${value}h ago`,
    daysAgo: (value) => `${value}d ago`,
  },
};

// End customers should not start provider OAuth themselves until the provider
// apps are live for non-test users. Stevin activates these connections during
// onboarding so customers never hit Google/Meta error pages.
const CLIENT_SELF_SERVICE_CONNECT_ENABLED = false;

export default function IntegrationsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const lang = useLanguage();
  const c = COPY[lang];
  // De taal komt na een /me-call binnen. Via een ref kunnen de effecten hun
  // oorspronkelijke dependency-array houden (geen dubbele fetch of dubbele toast).
  const langRef = useRef(lang);
  langRef.current = lang;

  const [authState, setAuthState] = useState<"loading" | "denied" | "ok">("loading");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null);

  // Slug + login guard
  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    // localStorage houdt de EIGEN login vast. Bij meekijken staat daar dus de
    // consultant in en niet de klant, en dan weigerde deze pagina ten onrechte.
    // /me beweegt wel mee met het actieve token, dus dat is de waarheid.
    const client = getClient();
    if (client?.slug === slug) {
      setAuthState("ok");
      return;
    }
    portalFetch<{ client?: { slug?: string } | null }>("/me")
      .then((me) => setAuthState(me.client?.slug === slug ? "ok" : "denied"))
      .catch(() => setAuthState("denied"));
  }, [slug, router]);

  // Read OAuth callback toasts (?platform=meta&connected=1 / ?error=...)
  useEffect(() => {
    const platform = searchParams.get("platform");
    const connected = searchParams.get("connected");
    const err = searchParams.get("error");
    const cc = COPY[langRef.current];
    if (connected === "1" && platform) {
      toast.success(cc.connectedToast(labelFor(platform)));
    } else if (err) {
      toast.error(cc.connectFailed(humanError(err, langRef.current)));
    }
  }, [searchParams]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await portalFetch<{ connections: Connection[] }>("/connect/status");
      setConnections(data.connections);
    } catch (e: any) {
      const cc = COPY[langRef.current];
      toast.error(cc.statusLoadFailed(e.message || cc.unknownError));
    }
  }, []);

  useEffect(() => {
    if (authState === "ok") fetchStatus();
  }, [authState, fetchStatus]);

  async function handleConnect(platformId: string) {
    if (!CLIENT_SELF_SERVICE_CONNECT_ENABLED) {
      toast.message(c.activatedByStevin);
      return;
    }
    setLoadingPlatform(platformId);
    try {
      const data = await portalFetch<{ url: string }>(`/connect/${platformId}/url`);
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(c.connectStartFailed(e.message || c.unknownError));
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
        <h1 className="text-xl font-bold mb-2">{c.noAccessTitle}</h1>
        <p className="text-muted-foreground mb-6">{c.noAccessBody}</p>
        <a href="/login" className="px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition">
          {c.login}
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">{c.pageTitle}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl">
          {c.pageIntro}
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
              lang={lang}
            />
          );
        })}
      </div>

      <ManualConnectionsSection lang={lang} />
    </div>
  );
}

// ── Manual API-key sections (e-mail tool + ticketing) ──────────

function ManualConnectionsSection({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h2 className="text-lg font-semibold mb-2">{c.manualTitle}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
        {c.manualIntro}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MANUAL_PLATFORM_IDS.map((id) => {
          const m = c.manual[id];
          return (
            <div key={id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
              <h3 className="font-semibold text-base">{m.title}</h3>
              <p className="text-xs text-muted-foreground leading-snug">{m.description}</p>
              <p className="text-xs text-muted-foreground">{c.forExample(m.examples)}</p>
              <a
                href={`mailto:koen@stevin.ai?subject=API-key%20${encodeURIComponent(m.title)}`}
                className="mt-auto px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-lg hover:bg-muted transition text-center"
              >
                {c.mailUs}
              </a>
            </div>
          );
        })}
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
  lang,
}: {
  platform: PlatformMeta;
  status: ConnectionStatus;
  connection: Connection | undefined;
  isLoading: boolean;
  onConnect: () => void;
  lang: Lang;
}) {
  const c = COPY[lang];
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="bg-white border border-border w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon icon={platform.iconName} width={24} height={24} style={{ color: platform.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base leading-tight">{platform.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{c.platformDescriptions[platform.id]}</p>
        </div>
        <StatusBadge status={status} lang={lang} />
      </div>

      {status === "connected" && connection?.connected_at && (
        <p className="text-xs text-muted-foreground">
          {c.connectedOn(formatDate(connection.connected_at, lang))}
          {connection.last_successful_sync_at ? c.lastSync(formatRelative(connection.last_successful_sync_at, lang)) : ""}
        </p>
      )}

      {status === "broken" && connection?.auth_failure_at && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {c.brokenSince(formatDate(connection.auth_failure_at, lang))}
          {connection.consecutive_failure_count && connection.consecutive_failure_count > 1
            ? c.failedSyncs(connection.consecutive_failure_count)
            : ""}
        </p>
      )}

      <div className="flex gap-2 mt-auto">
        {!platform.enabled ? (
          <button
            disabled
            className="flex-1 px-4 py-2 text-sm font-medium bg-muted text-muted-foreground rounded-lg cursor-not-allowed opacity-60"
          >
            {c.comingSoon}
          </button>
        ) : !CLIENT_SELF_SERVICE_CONNECT_ENABLED ? (
          <button
            type="button"
            disabled
            className="flex-1 px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-lg cursor-default opacity-80"
          >
            {status === "connected" ? c.connectedButton : status === "broken" ? c.letStevinRepair : c.viaStevin}
          </button>
        ) : status === "connected" ? (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-lg hover:bg-muted transition disabled:opacity-60"
          >
            {isLoading ? c.busy : c.connectAgain}
          </button>
        ) : status === "broken" ? (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-60"
          >
            {isLoading ? c.busy : c.reconnect}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-muted transition disabled:opacity-60"
          >
            {isLoading ? c.busy : c.connect}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, lang }: { status: ConnectionStatus; lang: Lang }) {
  const c = COPY[lang];
  if (status === "connected") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">{c.badgeConnected}</span>;
  }
  if (status === "broken") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">{c.badgeBroken}</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{c.badgeNotConnected}</span>;
}

// ── Helpers ──

function labelFor(platformId: string): string {
  const p = PLATFORMS.find((x) => x.id === platformId);
  return p?.name || platformId;
}

/**
 * Foutcode van de Hub omzetten naar een zin voor de klant.
 *
 * De Hub stuurt sinds de aanpassing van portalConnect.ts alleen kale redenen
 * mee: denied, invalid_callback, state_expired, pkce_missing,
 * token_exchange_failed, long_token_failed, no_refresh_token, tiktok_api_error
 * en server_error. Oudere links dragen nog de platformvariant
 * meta_callback_failed, google_ads_callback_failed,
 * google_analytics_callback_failed, google_search_console_callback_failed,
 * google_tag_manager_callback_failed, linkedin_callback_failed,
 * tiktok_callback_failed, x_callback_failed of snapchat_callback_failed; die
 * vallen allemaal op dezelfde zin terug.
 *
 * Onbekend blijft over: dan een algemene zin, nooit de kale code. De klant
 * hoort geen "no_refresh_token" te lezen.
 */
function humanError(code: string, lang: Lang): string {
  const errors = COPY[lang].errors;
  if (errors[code]) return errors[code];
  if (code.endsWith("_callback_failed")) return errors.callback_failed;
  return errors.generic;
}

function formatDate(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(localeFor(lang), { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string, lang: Lang): string {
  const c = COPY[lang];
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return c.minutesAgo(mins);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return c.hoursAgo(hours);
    const days = Math.floor(hours / 24);
    return c.daysAgo(days);
  } catch {
    return iso;
  }
}
