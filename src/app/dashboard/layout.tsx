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
} from "lucide-react";
import TermsModal from "@/components/TermsModal";
import { portalFetch } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overzicht", icon: LayoutDashboard },
  { href: "/dashboard/approvals", label: "Goedkeuringen", icon: Image },
  { href: "/dashboard/budget", label: "Budget", icon: Wallet },
  { href: "/dashboard/brain", label: "Brain", icon: Sparkles },
  { href: "/dashboard/chat", label: "Vraag Stevin", icon: MessageCircle },
  // {slug} wordt client-side ingevuld via clientSlug. Adminonly-flag toont 'm alleen voor admins.
  { href: "/dashboard/__SLUG__/integrations", label: "Koppelingen", icon: Plug, adminOnly: true, slugSlot: true },
  { href: "/dashboard/account", label: "Account", icon: UserCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [orgType, setOrgType] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const client = getClient();
    let user = getUser();

    if (user) {
      setUserEmail(user.email);
    } else {
      // No portal user — check Supabase session (Google OAuth)
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
      if (client.orgType) setOrgType(client.orgType);
    }
    setImpersonating(isImpersonating());

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Impersonation Banner */}
      {impersonating && (
        <div className="bg-warning text-black px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 z-50">
          <ShieldAlert className="w-4 h-4" />
          Je bekijkt dit portaal als consultant (read-only) &mdash; dit is wat de klant ziet
          <button
            onClick={() => { clearAuth(); window.close(); }}
            className="ml-3 px-2 py-0.5 bg-black/10 rounded text-xs hover:bg-black/20 transition"
          >
            Sluiten
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
            .map((item) => {
            const href = item.slugSlot ? item.href.replace("__SLUG__", getClient()?.slug || "") : item.href;
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
                {item.label}
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
            Uitloggen
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
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" className="p-2">
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
                .map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.slugSlot ? item.href.replace("__SLUG__", getClient()?.slug || "") : item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-bold transition ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
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
                Uitloggen
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
                via je bureau
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

      {/* Terms acceptance modal — blocks usage until accepted */}
      {showTerms && <TermsModal onAccepted={() => setShowTerms(false)} />}
      <FeedbackWidget />
    </div>
  );
}
