"use client";

import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getClient, getUser, isImpersonating, isLoggedIn } from "@/lib/auth";
import { createClient as createSupabaseClient } from "@/lib/supabase-browser";
import { useTheme } from "@/lib/theme";
import { useState, useEffect } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import {
  LayoutDashboard,
  Image,
  Wallet,
  MessageCircle,
  LogOut,
  ShieldAlert,
  Sun,
  Moon,
  Menu,
  X,
  Package,
  Phone,
  UserCircle,
  Settings2,
} from "lucide-react";
import TermsModal from "@/components/TermsModal";
import GlobalAlertBanner, { useGlobalAlerts } from "@/components/GlobalAlertBanner";
import { portalFetch } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/approvals", label: "Goedkeuringen", icon: Image },
  { href: "/dashboard/budget", label: "Budget", icon: Wallet },
  { href: "/dashboard/chat", label: "Stevin Assistant", icon: MessageCircle },
  { href: "/dashboard/campaigns", label: "Campagnes", icon: Settings2 },
  { href: "/dashboard/services", label: "Diensten", icon: Package },
  { href: "/dashboard/contact", label: "Contact", icon: Phone },
  { href: "/dashboard/account", label: "Account", icon: UserCircle },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [impersonating, setImpersonating] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const globalAlerts = useGlobalAlerts();

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

    if (client) setClientName(client.name);
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
      <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-card">
        <div className="flex h-14 items-center border-b border-border px-4">
          <img
            src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
            alt="Stevin.AI"
            className="h-6 w-auto"
          />
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-card-hover"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={toggle}
            aria-label={theme === "dark" ? "Schakel naar lichte modus" : "Schakel naar donkere modus"}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-card-hover transition"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === "dark" ? "Lichte modus" : "Donkere modus"}
          </button>
          <div className="px-3 py-1">
            {clientName && <p className="text-xs font-medium truncate">{clientName}</p>}
            <p className="text-xs text-muted truncate">{userEmail}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-danger hover:bg-danger-light transition"
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
            src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
            alt="Stevin.AI"
            className="h-5 w-auto"
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
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
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

      {/* Main Content */}
      <main className="flex-1 min-w-0 lg:pt-0 pt-14 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          <GlobalAlertBanner alerts={globalAlerts} />
          {children}
        </div>
      </main>
      </div>

      {/* Terms acceptance modal — blocks usage until accepted */}
      {showTerms && <TermsModal onAccepted={() => setShowTerms(false)} />}
      <FeedbackWidget />
    </div>
  );
}
