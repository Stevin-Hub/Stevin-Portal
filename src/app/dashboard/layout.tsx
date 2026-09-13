"use client";

import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getClient, getUser, isImpersonating, isLoggedIn } from "@/lib/auth";
import { createClient as createSupabaseClient } from "@/lib/supabase-browser";
import { useState, useEffect, useRef } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import {
  Home,
  Image,
  Wallet,
  Sparkles,
  MessageCircle,
  ShieldAlert,
  UserCircle,
  Link2,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";
import ClickwrapGate from "@/components/ClickwrapGate";
import { portalFetch } from "@/lib/api";
import { useLanguage, useLanguageReady, type Lang } from "@/lib/useLanguage";

/**
 * De schil van het portaal, in de vorm van Stevin Desk (W-124, fase 3).
 *
 * Koen, 13 sep 2026: "dezelfde dashboard-interface voor zowel app als desk;
 * desk heeft de iconische Stevin look and feel." Bron van die vorm is
 * Stevin-Desk/src/app/dashboard/app-shell.tsx: een topbar van 72 px met het
 * merk, de klantnaam en een versheidslabel, links een rail van 64 px met ronde
 * iconen, op mobiel een header van 60 px met een hamburger en een uitklapmenu.
 * De Desk-schil hangt aan Desk-stores, dus dit is een eigen schil in dezelfde
 * vorm, met dezelfde maten en tokens (aso-tokens, D-023).
 */

// Desk-tokens (Stevin-Desk/src/lib/aso-tokens.ts en app-shell.tsx). Niet
// afwijken; bij een conflict winnen deze van elke andere kleurbeschrijving.
const TOKENS = {
  page: "#f7f8fa",
  panel: "#ffffff",
  panelBlur: "rgba(255,255,255,0.82)",
  border: "#d6dde8",
  text: "#1f2933",
  muted: "#6b7280",
  muted2: "#8190a3",
  rail: "rgba(255,255,255,0.74)",
  railActive: "#eef1f5",
  navy: "#0a1628",
  positive: "#1f9d55",
  negative: "#d23f57",
  warning: "#d97706",
};

const TOPBAR = 72;
const TOPBAR_MOBILE = 60;
const RAIL = 64;

type NavItem = {
  href: string;
  label: Record<Lang, string>;
  icon: LucideIcon;
  creatorOnly?: boolean;
  adminOnly?: boolean;
  slugSlot?: boolean;
  /** Onderin de rail, zoals Desk de secundaire items onderaan zet. */
  bottom?: boolean;
};

// Labels per taal; de vlaggen (creatorOnly, adminOnly, slugSlot) blijven ongemoeid.
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: { nl: "Overzicht", en: "Overview" }, icon: Home },
  // Alleen zichtbaar voor klanten met een creator-profiel (D-021, flag uit /me).
  { href: "/dashboard/creator", label: { nl: "Creator", en: "Creator" }, icon: Clapperboard, creatorOnly: true },
  { href: "/dashboard/approvals", label: { nl: "Goedkeuringen", en: "Approvals" }, icon: Image },
  { href: "/dashboard/budget", label: { nl: "Budget", en: "Budget" }, icon: Wallet },
  { href: "/dashboard/brain", label: { nl: "Brain", en: "Brain" }, icon: Sparkles },
  { href: "/dashboard/chat", label: { nl: "Vraag Stevin", en: "Ask Stevin" }, icon: MessageCircle, bottom: true },
  // {slug} wordt client-side ingevuld via clientSlug. adminOnly houdt 'm bij
  // de eigenaar: accounts koppelen is een eigenaarshandeling, net als de
  // campagne-aanvragen die de Hub op rol admin afschermt (owner_only_request).
  // Bij meekijken tonen we het item wel. De consultant krijgt van de Hub altijd
  // de rol stagiair, dus schrijven blijft geblokkeerd, maar de banner belooft
  // "dit is wat de klant ziet" en dan hoort het menu ook te kloppen.
  { href: "/dashboard/__SLUG__/integrations", label: { nl: "Koppelingen", en: "Integrations" }, icon: Link2, adminOnly: true, slugSlot: true, bottom: true },
  { href: "/dashboard/account", label: { nl: "Account", en: "Account" }, icon: UserCircle, bottom: true },
];

interface ShellCopy {
  impersonation: string;
  close: string;
  menu: string;
  viaAgency: string;
  platform: string;
  logout: string;
  accountMenu: string;
  freshnessUnknown: string;
  freshnessNone: string;
  freshnessThrough: (datum: string) => string;
  freshnessStale: (datum: string, dagen: number) => string;
}

const COPY: Record<Lang, ShellCopy> = {
  nl: {
    impersonation: "Je bekijkt dit portaal als consultant (read-only), dit is wat de klant ziet",
    close: "Sluiten",
    menu: "Menu",
    viaAgency: "via je bureau",
    platform: "Stevin.AI",
    logout: "Uitloggen",
    accountMenu: "Accountmenu",
    freshnessUnknown: "Meetstand onbekend",
    freshnessNone: "Nog geen cijfers",
    freshnessThrough: (datum) => `Cijfers t/m ${datum}`,
    freshnessStale: (datum, dagen) => `Cijfers t/m ${datum}, ${dagen} dagen oud`,
  },
  en: {
    impersonation: "You are viewing this portal as a consultant (read-only), this is what the client sees",
    close: "Close",
    menu: "Menu",
    viaAgency: "via your agency",
    platform: "Stevin.AI",
    logout: "Log out",
    accountMenu: "Account menu",
    freshnessUnknown: "Measurement status unknown",
    freshnessNone: "No figures yet",
    freshnessThrough: (datum) => `Figures through ${datum}`,
    freshnessStale: (datum, dagen) => `Figures through ${datum}, ${dagen} days old`,
  },
};

/** Datum als "12 sep" of "12 Sep", zonder jaartal; het jaar staat op de schermen zelf. */
function korteDatum(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Het versheidslabel in de topbar, de tegenhanger van het synclabel in Desk.
 * Leest dezelfde velden als het Overzicht (dataTot, dagenSindsLaatsteMeting),
 * zodat de kop nooit iets anders zegt dan de cijfers eronder.
 */
type Versheid =
  | { status: "laden" }
  | { status: "onbekend" }
  | { status: "geen" }
  | { status: "vers"; dataTot: string }
  | { status: "oud"; dataTot: string; dagen: number };

function VersheidPill({ v, c, lang }: { v: Versheid; c: ShellCopy; lang: Lang }) {
  if (v.status === "laden") return null;
  const kleur =
    v.status === "vers" ? TOKENS.positive : v.status === "oud" ? (v.dagen >= 7 ? TOKENS.negative : TOKENS.warning) : TOKENS.muted2;
  const tekst =
    v.status === "vers"
      ? c.freshnessThrough(korteDatum(v.dataTot, lang))
      : v.status === "oud"
        ? c.freshnessStale(korteDatum(v.dataTot, lang), v.dagen)
        : v.status === "geen"
          ? c.freshnessNone
          : c.freshnessUnknown;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 34,
        padding: "0 14px",
        borderRadius: 999,
        border: `1px solid ${TOKENS.border}`,
        background: TOKENS.panel,
        color: TOKENS.text,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: kleur, flex: "0 0 auto" }} />
      {tekst}
    </span>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lang = useLanguage();
  const langReady = useLanguageReady();
  const c = COPY[lang];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const [clientName, setClientName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [orgType, setOrgType] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [canSign, setCanSign] = useState(true);
  const [versheid, setVersheid] = useState<Versheid>({ status: "laden" });
  // Rol van de ingelogde klantgebruiker: admin (eigenaar), medewerker of
  // stagiair. Bron is /me, want getUser() geeft bij de Google-login
  // "authenticated" terug en dat is geen portaalrol.
  const [role, setRole] = useState<string | null>(null);
  const isAdmin = role === "admin";
  // Zonder slug wordt de koppelingen-link /dashboard//integrations, een dode
  // pagina. Dan tonen we het item liever niet.
  const [clientSlug, setClientSlug] = useState("");

  // De root-layout zet lang="nl" omdat die server-side draait en de klanttaal
  // niet kent. Hier is die wel bekend, dus zetten we het attribuut bij voor
  // schermlezers, browservertaling en afbreken van woorden.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const client = getClient();
    const user = getUser();

    if (user) {
      setUserEmail(user.email);
    } else {
      // No portal user, check Supabase session (Google OAuth)
      const supabase = createSupabaseClient();
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: { email: string | null } } | null } }) => {
        if (session?.user) {
          setUserEmail(session.user.email ?? "");
        } else if (!isLoggedIn()) {
          // No portal token AND no Supabase session → redirect
          router.replace("/login");
        }
      });
    }

    if (client) {
      setClientName(client.name);
      if (client.slug) setClientSlug(client.slug);
      if (client.orgType) setOrgType(client.orgType);
    }
    setImpersonating(isImpersonating());

    // /me is de waarheid over wiens portaal dit is: bij impersonatie wees de
    // localStorage-naam naar de EIGEN login (Van Gestel) terwijl de data van
    // de meegekeken klant kwam (16 aug 2026). Naam en creator-vlag komen
    // daarom altijd uit /me, dat met het actieve token meebeweegt.
    portalFetch<{ creator?: boolean; client?: { name?: string; slug?: string } | null; user?: { role?: string } | null }>("/me")
      .then((me) => {
        setIsCreator(Boolean(me.creator));
        if (me.client?.name) setClientName(me.client.name);
        if (me.client?.slug) setClientSlug(me.client.slug);
        setRole(me.user?.role ?? null);
      })
      .catch(() => {
        setIsCreator(false);
        setRole(user?.role ?? null);
      });

    // Versheid voor de topbar: dezelfde velden als het Overzicht. Een storing
    // is "onbekend", niet "geen cijfers" (D-046).
    portalFetch<{ dataTot?: string | null; dagenSindsLaatsteMeting?: number | null; reason?: string }>("/dashboard?days=7")
      .then((d) => {
        if (!d.dataTot) {
          setVersheid({ status: "geen" });
          return;
        }
        const dagen = typeof d.dagenSindsLaatsteMeting === "number" ? d.dagenSindsLaatsteMeting : null;
        if (dagen !== null && dagen >= 2) setVersheid({ status: "oud", dataTot: d.dataTot, dagen });
        else setVersheid({ status: "vers", dataTot: d.dataTot });
      })
      .catch(() => setVersheid({ status: "onbekend" }));

    // Acceptatiestand uit het register (W-124). Bij impersonatie overslaan.
    // canSign is false bij het oude portal-token: dan vraagt de gate om opnieuw
    // in te loggen in plaats van een vinkje aan te bieden dat niet vastgelegd
    // kan worden.
    if (user && !isImpersonating()) {
      portalFetch<{ accepted: boolean; canSign?: boolean }>("/terms/status")
        .then((data) => {
          if (!data.accepted) {
            setCanSign(data.canSign !== false);
            setShowTerms(true);
          }
        })
        .catch(() => {});
    }
  }, [router]);

  // Menu's dicht bij een klik erbuiten en bij navigatie.
  useEffect(() => {
    function sluit(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", sluit);
    return () => document.removeEventListener("mousedown", sluit);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    clearAuth();
    router.replace("/login");
  }

  // De schermen houden hun eigen spinner aan tot de taal bekend is. Doet de
  // schil dat niet, dan flitst het menu alsnog in de verkeerde taal.
  if (!langReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const visibleNav = NAV_ITEMS
    .filter((item) => !item.creatorOnly || isCreator)
    .filter((item) => !item.adminOnly || isAdmin || impersonating)
    .filter((item) => !item.slugSlot || clientSlug !== "")
    .map((item) => ({ ...item, href: item.slugSlot ? item.href.replace("__SLUG__", clientSlug) : item.href }));

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
  const initials = (userEmail.match(/^([a-zA-Z])/)?.[1] ?? "?").toUpperCase();
  const viaBureau = orgType === "agency" || orgType === "agency_client";
  const bannerHoogte = impersonating ? 40 : 0;

  const railKnop = (item: (typeof visibleNav)[number]) => {
    const active = isActive(item.href);
    return (
      <a
        key={item.href}
        href={item.href}
        title={item.label[lang]}
        aria-label={item.label[lang]}
        aria-current={active ? "page" : undefined}
        style={{
          display: "grid",
          placeItems: "center",
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: active ? TOKENS.railActive : "transparent",
          color: active ? TOKENS.navy : TOKENS.muted,
          textDecoration: "none",
          transition: "background 120ms",
        }}
      >
        <item.icon size={22} strokeWidth={2.2} aria-hidden="true" />
      </a>
    );
  };

  return (
    <div
      className="psh-root"
      style={{
        minHeight: "100vh",
        position: "relative",
        background: TOKENS.page,
        backgroundImage: "radial-gradient(circle at 84% 0%, rgba(60,142,255,0.07), transparent 32rem)",
        color: TOKENS.text,
      }}
    >
      <style>{`
        /* Zelfde opzet als Desk (app-shell.tsx): topbar en rail staan op
           position:fixed; onder 768px vervalt de rail en neemt de hamburger
           het over, de topbar wordt 60px en toont het compacte icoon. */
        .psh-burger { display: none; }
        .psh-mobile-nav { display: none; }
        .psh-logo-icon { display: none; }
        @media (max-width: 768px) {
          .psh-rail { display: none !important; }
          .psh-burger { display: grid !important; }
          .psh-topbar {
            height: ${TOPBAR_MOBILE}px !important;
            display: flex !important;
            gap: 10px !important;
            padding: 0 12px !important;
          }
          .psh-logo-full { display: none !important; }
          .psh-logo-icon { display: block !important; }
          .psh-brand { border-right: 0 !important; padding-right: 0 !important; flex: 0 0 auto !important; }
          .psh-acct { flex: 1 1 auto !important; min-width: 0 !important; }
          .psh-acct-name { font-size: 15px !important; }
          .psh-spacer { display: none !important; }
          .psh-sync { display: none !important; }
          .psh-actions { flex: 0 0 auto !important; }
          .psh-content { margin-left: 0 !important; padding-top: ${TOPBAR_MOBILE}px !important; }
          .psh-main { padding: 16px 14px 28px !important; }
          .psh-mobile-nav { display: block; }
        }
      `}</style>

      {/* Meekijkbanner: boven alles, schuift topbar en rail omlaag */}
      {impersonating && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: bannerHoogte,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "0 16px",
            background: "#fde68a",
            color: TOKENS.navy,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <ShieldAlert size={16} aria-hidden="true" />
          {c.impersonation}
          <button
            type="button"
            onClick={() => { clearAuth(); window.close(); }}
            style={{ marginLeft: 12, padding: "2px 8px", borderRadius: 6, border: 0, background: "rgba(10,22,40,0.1)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "inherit" }}
          >
            {c.close}
          </button>
        </div>
      )}

      {/* Mobiel uitklapmenu, alleen als de hamburger open is */}
      {mobileOpen && (
        <>
          <div
            className="psh-mobile-nav"
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: `${TOPBAR_MOBILE + bannerHoogte}px 0 0 0`, zIndex: 39, background: "rgba(15,23,42,0.35)" }}
          />
          <nav
            className="psh-mobile-nav"
            aria-label={c.menu}
            style={{
              position: "fixed",
              top: TOPBAR_MOBILE + bannerHoogte,
              left: 0,
              right: 0,
              zIndex: 40,
              background: TOKENS.panel,
              borderBottom: `1px solid ${TOKENS.border}`,
              boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {visibleNav.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: active ? TOKENS.navy : TOKENS.text,
                    background: active ? TOKENS.railActive : "transparent",
                    fontSize: 15,
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <item.icon size={22} strokeWidth={2.2} aria-hidden="true" />
                  {item.label[lang]}
                </a>
              );
            })}
            <div style={{ height: 1, background: TOKENS.border, margin: "6px 4px" }} />
            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                border: 0,
                background: "transparent",
                color: TOKENS.negative,
                fontSize: 15,
                fontWeight: 500,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {c.logout}
            </button>
          </nav>
        </>
      )}

      {/* Topbar */}
      <header
        className="psh-topbar"
        style={{
          position: "fixed",
          top: bannerHoogte,
          left: 0,
          right: 0,
          height: TOPBAR,
          display: "grid",
          // merk : klant : ruimte : acties, zoals Desk
          gridTemplateColumns: "minmax(220px, 250px) minmax(0, 360px) 1fr auto",
          alignItems: "center",
          gap: 18,
          borderBottom: `1px solid ${TOKENS.border}`,
          background: TOKENS.panelBlur,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          padding: "0 22px 0 14px",
          zIndex: 30,
        }}
      >
        {/* Hamburger (alleen mobiel) */}
        <button
          type="button"
          className="psh-burger"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={c.menu}
          aria-expanded={mobileOpen}
          style={{
            placeItems: "center",
            width: 38,
            height: 38,
            flex: "0 0 auto",
            borderRadius: 10,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.panel,
            color: TOKENS.text,
            cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        {/* Merk */}
        <div
          className="psh-brand"
          style={{ display: "flex", alignItems: "center", height: 48, borderRight: `1px solid ${TOKENS.border}`, paddingRight: 24 }}
        >
          {/* Topbar is altijd licht, dus altijd het full-color lockup; op mobiel het compacte icoon. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="psh-logo-full" src="/stevin-lockup-default.svg" alt="Stevin.AI" style={{ height: 32, width: "auto", display: "block" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="psh-logo-icon" src="/stevin-mark-blue.svg" alt="Stevin.AI" style={{ height: 28, width: "auto", display: "none" }} />
        </div>

        {/* Klant */}
        <div className="psh-acct" style={{ minWidth: 0, paddingLeft: 4 }}>
          <span style={{ display: "block", color: TOKENS.muted2, fontSize: 12, fontWeight: 600 }}>
            {viaBureau ? c.viaAgency : c.platform}
          </span>
          <div
            className="psh-acct-name"
            style={{
              marginTop: 2,
              color: "#4b5563",
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {clientName || " "}
          </div>
        </div>

        <div className="psh-spacer" aria-hidden="true" />

        {/* Acties: versheid en account */}
        <div className="psh-actions" style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }} ref={userMenuRef}>
          <span className="psh-sync" style={{ display: "inline-flex" }}>
            <VersheidPill v={versheid} c={c} lang={lang} />
          </span>
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-label={c.accountMenu}
            aria-expanded={userMenuOpen}
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: TOKENS.navy,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {initials}
          </button>

          {userMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                minWidth: 220,
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 10,
                boxShadow: "0 12px 40px rgba(31,41,51,0.12)",
                padding: "8px 6px",
                zIndex: 50,
              }}
            >
              <div style={{ padding: "4px 12px 8px", fontSize: 12, color: TOKENS.muted, borderBottom: `1px solid ${TOKENS.border}`, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis" }}>
                {clientName && <div style={{ color: TOKENS.text, fontWeight: 600, marginBottom: 2 }}>{clientName}</div>}
                {userEmail}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  fontSize: 13,
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  borderRadius: 6,
                  color: TOKENS.negative,
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f6fa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {c.logout}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Rail: 64 px, alleen iconen, label als tooltip */}
      <aside
        className="psh-rail"
        aria-label={c.menu}
        style={{
          position: "fixed",
          top: TOPBAR + bannerHoogte,
          left: 0,
          width: RAIL,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          borderRight: `1px solid ${TOKENS.border}`,
          background: TOKENS.rail,
          padding: "16px 0",
          height: `calc(100vh - ${TOPBAR + bannerHoogte}px)`,
          zIndex: 20,
        }}
      >
        {visibleNav.filter((i) => !i.bottom).map(railKnop)}
        <div style={{ flex: 1 }} />
        {visibleNav.filter((i) => i.bottom).map(railKnop)}
      </aside>

      {/* Inhoud */}
      <div className="psh-content" style={{ marginLeft: RAIL, paddingTop: TOPBAR + bannerHoogte, minWidth: 0 }}>
        <main className="psh-main" style={{ width: "min(100%, 1640px)", margin: "0 auto", padding: "20px 28px 36px", minWidth: 0 }}>
          {children}
        </main>
      </div>

      {/* Terms acceptance modal, blocks usage until accepted */}
      {showTerms && <ClickwrapGate canSign={canSign} onAccepted={() => setShowTerms(false)} />}
      <FeedbackWidget />
    </div>
  );
}
