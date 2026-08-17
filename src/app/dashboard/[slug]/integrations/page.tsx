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
import { useLanguage, useLanguageReady, localeFor, type Lang } from "@/lib/useLanguage";
import { toast } from "sonner";

/**
 * Drie toestanden waren er, en dat waren er een te weinig.
 *
 * "connected" betekende alleen dat er een rij in de database stond, niet dat er
 * iets binnenkwam. Van Gestel Kozijnen had GA4 sinds 8 april 2026 op groen
 * staan terwijl er nooit een meting is aangekomen. Daarom "attention": wel
 * gekoppeld, maar het levert niets of het loopt achter. Dat is geen storing en
 * ook geen gezonde koppeling, en het hoort niet als een van beide te lezen.
 */
type ConnectionStatus = "not_connected" | "connected" | "attention" | "broken";

/**
 * Van wie de koppeling is.
 *
 * "client" betekent: dit platform staat op naam van deze klant en levert data
 * voor deze klant. "organization" betekent: op de organisatie van deze klant
 * bestaat een koppeling, maar niet voor deze klant. Tot 17 aug 2026 kende het
 * scherm dat verschil niet en presenteerde het de koppelingen van de
 * organisatie als die van de klant.
 */
type ConnectionScope = "client" | "organization" | null;

/**
 * Waarom een koppeling aandacht vraagt. De Hub bepaalt dit, het scherm vertaalt
 * het alleen naar een zin. Onbekende redenen vallen terug op een algemene zin,
 * nooit op de kale code.
 */
type HealthReason = "no_data_yet" | "data_stale" | "sync_warning" | "sync_stale" | "sync_error" | "auth_failure";

interface Connection {
  platform: string;
  status: ConnectionStatus;
  scope?: ConnectionScope;
  health_reason?: HealthReason | string | null;
  expects_data?: boolean;
  account_name?: string | null;
  connected_at?: string | null;
  last_data_at?: string | null;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
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
    id: "youtube",
    name: "YouTube",
    iconName: "simple-icons:youtube",
    iconColor: "#FF0000",
    // Geen self-service OAuth-route in de Hub; de kanaalkoppeling loopt via
    // Stevin. Staat hier omdat het voor een creator-klant het enige platform
    // kan zijn dat echt data levert, en dat hoort niet van het scherm te
    // ontbreken terwijl er wel dertien lege kaarten staan.
    enabled: false,
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
  availableViaOrganization: string;
  brokenSince: (date: string) => string;
  syncFailedOn: (date: string) => string;
  syncFailed: string;
  failedSyncs: (count: number) => string;
  noDataYet: string;
  dataStale: (date: string) => string;
  syncWarning: string;
  syncStale: (date: string) => string;
  attentionGeneric: string;
  comingSoon: string;
  connectedButton: string;
  letStevinRepair: string;
  letStevinCheck: string;
  viaStevin: string;
  busy: string;
  connectAgain: string;
  reconnect: string;
  connect: string;
  badgeConnected: string;
  badgeAttention: string;
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
      youtube: "Weergaven, kijktijd en abonnees van je YouTube-kanaal.",
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
    lastSync: (relative) => ` · Laatste data ${relative}`,
    // Neutraal op organisatieniveau. Hier stond "Stevin heeft dit platform
    // gekoppeld", terwijl de organisatie van de klant lang niet altijd Stevin
    // is: Van Gestel hangt onder Alona Marketing, De Avenue onder zichzelf.
    // Niet "op je account": bij een klant onder een bureau zijn dit de accounts
    // van dat bureau. Casey zou anders lezen dat zijn Meta al gekoppeld is
    // terwijl hij dat account helemaal niet heeft.
    availableViaOrganization: "Dit platform loopt via de organisatie die je account beheert, nog niet op jouw eigen data.",
    brokenSince: (date) => `Koppeling werkt niet meer sinds ${date}`,
    syncFailedOn: (date) => `Het ophalen van ${date} is mislukt`,
    syncFailed: "Het laatste ophalen is mislukt",
    failedSyncs: (count) => ` (${count} mislukte pogingen)`,
    noDataYet: "Er komt nog geen data binnen.",
    dataStale: (date) => `De laatste data is van ${date}.`,
    syncWarning: "De laatste keer ophalen leverde geen data op.",
    syncStale: (date) => `Er is sinds ${date} niets opgehaald.`,
    attentionGeneric: "Er komt op dit moment geen data binnen.",
    comingSoon: "Binnenkort",
    connectedButton: "Gekoppeld",
    letStevinRepair: "Laat Stevin herstellen",
    letStevinCheck: "Laat Stevin nakijken",
    viaStevin: "Via Stevin",
    busy: "Bezig...",
    connectAgain: "Opnieuw koppelen",
    reconnect: "Opnieuw verbinden",
    connect: "Verbinden",
    badgeConnected: "Verbonden",
    badgeAttention: "Let op",
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
      youtube: "Views, watch time and subscribers from your YouTube channel.",
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
    lastSync: (relative) => ` · Last data ${relative}`,
    availableViaOrganization: "This platform runs through the organisation that manages your account, not on your own data yet.",
    brokenSince: (date) => `Connection stopped working on ${date}`,
    syncFailedOn: (date) => `The fetch on ${date} failed`,
    syncFailed: "The last fetch failed",
    failedSyncs: (count) => ` (${count} failed attempts)`,
    noDataYet: "No data is coming in yet.",
    dataStale: (date) => `The most recent data is from ${date}.`,
    syncWarning: "The last fetch returned no data.",
    syncStale: (date) => `Nothing has been fetched since ${date}.`,
    attentionGeneric: "No data is coming in right now.",
    comingSoon: "Coming soon",
    connectedButton: "Connected",
    letStevinRepair: "Let Stevin repair it",
    letStevinCheck: "Let Stevin check it",
    viaStevin: "Via Stevin",
    busy: "Working...",
    connectAgain: "Connect again",
    reconnect: "Reconnect",
    connect: "Connect",
    badgeConnected: "Connected",
    badgeAttention: "Attention",
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
  const langReady = useLanguageReady();
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

  // langReady erbij: de taal komt uit /me en tot die er is klopt geen enkele
  // zin op dit scherm. De spinner heeft geen taal, dus die kan blijven staan.
  if (authState === "loading" || !langReady) {
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
  // Alleen een koppeling van de klant zelf mag zich als de zijne voordoen. Een
  // koppeling die alleen op bureau-niveau bestaat, krijgt geen groene badge,
  // geen datum en geen sync-regel.
  const isOwn = connection?.scope === "client";
  const viaOrganizationOnly = connection?.scope === "organization";
  // Zolang de Hub nog de oude vorm zonder scope teruggeeft, blijft de badge
  // grijs. Te weinig claimen is hier de veilige kant: een groene badge die niet
  // van de klant is, is precies wat dit scherm moest afleren.
  const badgeStatus: ConnectionStatus = isOwn ? status : "not_connected";
  // De datumregel hoort ook bij "let op": juist daar wil je zien hoe lang dit
  // al zo staat. Van Gestel Kozijnen leest dan "Gekoppeld op 8 apr 2026" met
  // daaronder dat er nog geen data binnenkomt.
  const showsDateLine = isOwn && (status === "connected" || status === "attention");
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
        <StatusBadge status={badgeStatus} lang={lang} />
      </div>

      {showsDateLine && connection?.connected_at && (
        <p className="text-xs text-muted-foreground">
          {c.connectedOn(formatDate(connection.connected_at, lang))}
          {/* Bij "let op" draagt de oranje regel hieronder de recentheid, dus
              hier geen tweede tijdsaanduiding die iets anders lijkt te zeggen. */}
          {status === "connected" && connection.last_data_at
            ? c.lastSync(formatRelative(connection.last_data_at, lang))
            : ""}
          {connection.account_name ? ` · ${connection.account_name}` : ""}
        </p>
      )}

      {viaOrganizationOnly && <p className="text-xs text-muted-foreground">{c.availableViaOrganization}</p>}

      {isOwn && status === "attention" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{attentionLine(connection, lang)}</p>
      )}

      {/* Kapot is niet meer alleen een ingetrokken toegang. Een sync die faalt
          maakt de koppeling net zo goed kapot, en die klanten hebben vaak geen
          org-token: Van Gestel heeft er nul. Zonder deze tak zou hun kaart rood
          kleuren zonder een woord uitleg. */}
      {isOwn && status === "broken" && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {connection?.auth_failure_at
            ? c.brokenSince(formatDate(connection.auth_failure_at, lang))
            : connection?.last_sync_at
              ? c.syncFailedOn(formatDate(connection.last_sync_at, lang))
              : c.syncFailed}
          {/* Expliciet vergelijken, niet op de waarheid van het getal leunen.
              Bij een sync-fout zonder org-token is deze teller 0, en dan zou
              "0 && ..." een kale nul op de kaart zetten. Van Gestel heeft geen
              org-tokens, dus dat pad is echt bereikbaar. */}
          {(connection?.consecutive_failure_count ?? 0) > 1
            ? c.failedSyncs(connection?.consecutive_failure_count ?? 0)
            : ""}
        </p>
      )}

      <div className="flex gap-2 mt-auto">
        {isOwn && (!CLIENT_SELF_SERVICE_CONNECT_ENABLED || !platform.enabled) ? (
          // Loopt voor deze klant. Gaat voor op "Binnenkort", want een platform
          // dat al data levert is niet iets van later. Geldt ook als de klant
          // ooit zelf mag koppelen: YouTube heeft geen self-service-route.
          <button
            type="button"
            disabled
            className="flex-1 px-4 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-lg cursor-default opacity-80"
          >
            {status === "broken" ? c.letStevinRepair : status === "attention" ? c.letStevinCheck : c.connectedButton}
          </button>
        ) : !platform.enabled ? (
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
            {c.viaStevin}
          </button>
        ) : status === "connected" || status === "attention" ? (
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
  if (status === "attention") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">{c.badgeAttention}</span>;
  }
  if (status === "broken") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">{c.badgeBroken}</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{c.badgeNotConnected}</span>;
}

/**
 * De reden uit de Hub omzetten naar een zin voor de klant.
 *
 * De rauwe error_message van de connector komt hier bewust niet in beeld. Die
 * bevat dingen als API-payloads en env-variabelenamen, en dat is geen taal voor
 * een klantscherm. De reden zelf is genoeg om te weten wat er aan de hand is.
 */
function attentionLine(connection: Connection | undefined, lang: Lang): string {
  const c = COPY[lang];
  switch (connection?.health_reason) {
    case "no_data_yet":
      return c.noDataYet;
    case "data_stale":
      return connection.last_data_at ? c.dataStale(formatDate(connection.last_data_at, lang)) : c.attentionGeneric;
    case "sync_warning":
      return c.syncWarning;
    case "sync_stale":
      return connection.last_sync_at ? c.syncStale(formatDate(connection.last_sync_at, lang)) : c.attentionGeneric;
    default:
      return c.attentionGeneric;
  }
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
