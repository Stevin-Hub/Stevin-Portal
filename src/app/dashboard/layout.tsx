"use client";

import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getClient, getUser, isImpersonating, isLoggedIn } from "@/lib/auth";
import { createClient as createSupabaseClient } from "@/lib/supabase-browser";
import { useState, useEffect } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import {
  LayoutDashboard,
  Image,
  Wallet,
  Sparkles,
  MessageCircle,
  LogOut,
  ShieldAlert,
  Menu,
  X,
  UserCircle,
  Plug,
  Clapperboard,
} from "lucide-react";
import TermsModal from "@/components/TermsModal";
import { portalFetch } from "@/lib/api";
import { useLanguage, useLanguageReady, type Lang } from "@/lib/useLanguage";

// Labels per taal; de vlaggen (creatorOnly, adminOnly, slugSlot) blijven ongemoeid.
const NAV_ITEMS = [
  { href: "/dashboard", label: { nl: "Overzicht", en: "Overview" }, icon: LayoutDashboard },
  // Alleen zichtbaar voor klanten met een creator-profiel (D-021, flag uit /me).
  { href: "/dashboard/creator", label: { nl: "Creator", en: "Creator" }, icon: Clapperboard, creatorOnly: true },
  { href: "/dashboard/approvals", label: { nl: "Goedkeuringen", en: "Approvals" }, icon: Image },
  { href: "/dashboard/budget", label: { nl: "Budget", en: "Budget" }, icon: Wallet },
  { href: "/dashboard/brain", label: { nl: "Brain", en: "Brain" }, icon: Sparkles },
  { href: "/dashboard/chat", label: { nl: "Vraag Stevin", en: "Ask Stevin" }, icon: MessageCircle },
  // {slug} wordt client-side ingevuld via clientSlug. adminOnly houdt 'm bij
  // de eigenaar: accounts koppelen is een eigenaarshandeling, net als de
  // campagne-aanvragen die de Hub op rol admin afschermt (owner_only_request).
  // Bij meekijken tonen we het item wel. De consultant krijgt van de Hub altijd
  // de rol stagiair, dus schrijven blijft geblokkeerd, maar de banner belooft
  // "dit is wat de klant ziet" en dan hoort het menu ook te kloppen.
  { href: "/dashboard/__SLUG__/integrations", label: { nl: "Koppelingen", en: "Integrations" }, icon: Plug, adminOnly: true, slugSlot: true },
  { href: "/dashboard/account", label: { nl: "Account", en: "Account" }, icon: UserCircle },
];

interface ShellCopy {
  impersonation: string;
  close: string;
  menu: string;
  viaAgency: string;
  logout: string;
}

const COPY: Record<Lang, ShellCopy> = {
  nl: {
    impersonation: "Je bekijkt dit portaal als consultant (read-only), dit is wat de klant ziet",
    close: "Sluiten",
    menu: "Menu",
    viaAgency: "via je bureau",
    logout: "Uitloggen",
  },
  en: {
    impersonation: "You are viewing this portal as a consultant (read-only), this is what the client sees",
    close: "Close",
    menu: "Menu",
    viaAgency: "via your agency",
    logout: "Log out",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const lang = useLanguage();
  const langReady = useLanguageReady();
  const c = COPY[lang];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [orgType, setOrgType] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
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
    let user = getUser();

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

    // Check terms acceptance (skip for impersonation)
    if (user && !isImpersonating()) {
      portalFetch<{ accepted: boolean }>("/terms/status")
        .then((data) => { if (!data.accepted) setShowTerms(true); })
        .catch(() => {});
    }
  }, [router]);

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Impersonation Banner */}
      {impersonating && (
        <div className="bg-warning text-black px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 z-50">
          <ShieldAlert className="w-4 h-4" />
          {c.impersonation}
          <button
            onClick={() => { clearAuth(); window.close(); }}
            className="ml-3 px-2 py-0.5 bg-black/10 rounded text-xs hover:bg-black/20 transition"
          >
            {c.close}
          </button>
        </div>
      )}

      <div className="flex flex-1">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card/90">
        <div className="flex h-20 items-center border-b border-border px-5">
          <img
            src="/stevin-lockup-mono-dark.png"
            alt="Stevin.AI"
            className="h-8 w-auto max-w-[150px] object-contain"
          />
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {NAV_ITEMS
            .filter((item) => !('hideForAgency' in item && item.hideForAgency) || (orgType !== "agency" && orgType !== "agency_client"))
            .filter((item) => !('creatorOnly' in item && item.creatorOnly) || isCreator)
            .filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin || impersonating)
            .filter((item) => !('slugSlot' in item && item.slugSlot) || clientSlug !== "")
            .map((item) => {
            const href = item.slugSlot ? item.href.replace("__SLUG__", clientSlug) : item.href;
            const isActive = pathname === href || (href === "/dashboard" && pathname === "/dashboard");
            return (
              <a
                key={item.href}
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                  isActive
                    ? "bg-accent-light text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label[lang]}
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <div className="px-3 py-1">
            {clientName && <p className="text-xs font-medium truncate">{clientName}</p>}
            <p className="text-xs text-muted truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-2xl text-sm text-danger hover:bg-danger-light transition"
          >
            <LogOut className="w-4 h-4" />
            {c.logout}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <img
            src="/stevin-lockup-mono-dark.png"
            alt="Stevin.AI"
            className="h-7 w-auto max-w-[132px] object-contain"
          />
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label={c.menu} className="p-2">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-64 bg-card border-l border-border p-4 pt-16" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1">
              {NAV_ITEMS
                .filter((item) => !('hideForAgency' in item && item.hideForAgency) || (orgType !== "agency" && orgType !== "agency_client"))
                .filter((item) => !('creatorOnly' in item && item.creatorOnly) || isCreator)
                .filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin || impersonating)
                .filter((item) => !('slugSlot' in item && item.slugSlot) || clientSlug !== "")
                .map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.slugSlot ? item.href.replace("__SLUG__", clientSlug) : item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label[lang]}
                  </a>
                );
              })}
            </nav>
            <div className="mt-6 pt-4 border-t border-border">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 w-full text-sm text-danger"
              >
                <LogOut className="w-4 h-4" />
                {c.logout}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main column: Desk-stijl topbar + content */}
      <div className="flex-1 min-w-0 flex flex-col lg:pt-0 pt-14 overflow-hidden">
        {/* Topbar (desktop): klant-context links, gebruiker rechts */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur px-8">
          <div className="flex items-center gap-3 min-w-0">
            {clientName && (
              <span className="text-sm font-semibold text-foreground truncate">{clientName}</span>
            )}
            {(orgType === "agency" || orgType === "agency_client") && (
              <span className="text-[11px] font-medium text-muted-foreground rounded-full border border-border px-2 py-0.5">
                {c.viaAgency}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {userEmail && <span className="text-xs text-muted-foreground truncate max-w-[220px]">{userEmail}</span>}
            <div className="w-8 h-8 rounded-full bg-accent-light text-accent flex items-center justify-center text-xs font-bold uppercase">
              {(userEmail || "?").slice(0, 2)}
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-auto">
          <div className="mx-auto max-w-[1640px] p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      </div>

      {/* Terms acceptance modal, blocks usage until accepted */}
      {showTerms && <TermsModal onAccepted={() => setShowTerms(false)} />}
      <FeedbackWidget />
    </div>
  );
}
