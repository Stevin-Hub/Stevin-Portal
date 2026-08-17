"use client";

/**
 * Inlogscherm. De klanttaal uit clients.advisor_language is hier nog niet
 * bekend, want er is geen sessie. Daarom kiest dit scherm op de browsertaal:
 * begint navigator.language met "nl", dan Nederlands, anders Engels. Weet de
 * browser niets, dan blijft het Nederlands.
 *
 * De keuze staat bewust in een effect en niet in de eerste render, zodat
 * server en client dezelfde HTML opleveren. In datzelfde effect gaat ook
 * document.documentElement.lang mee, want de root-layout zet lang="nl" en dit
 * scherm valt buiten het dashboard, net als /auth/verify.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase-browser";
// Note: createClient kept for magic link OTP flow
import { toast } from "sonner";
import type { Lang } from "@/lib/useLanguage";

interface Copy {
  welcome: string;
  loginTitle: string;
  loginSubtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  submitting: string;
  noPassword: string;
  checkInbox: string;
  sentTo: string;
  linkValidity: string;
  tryAgain: string;
  error: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    welcome: "Welkom bij jouw dashboard",
    loginTitle: "Inloggen",
    loginSubtitle: "Log in op je dashboard.",
    emailLabel: "E-mailadres",
    emailPlaceholder: "naam@bedrijf.nl",
    submit: "Inloglink versturen",
    submitting: "Bezig...",
    noPassword: "Geen wachtwoord nodig. Veilig inloggen via je e-mail.",
    checkInbox: "Check je inbox",
    sentTo: "We hebben een inloglink gestuurd naar",
    linkValidity: "De link is 15 minuten geldig. Niet ontvangen? Check je spam of",
    tryAgain: "probeer opnieuw",
    error: "Er ging iets mis. Probeer het opnieuw.",
  },
  en: {
    welcome: "Welcome to your dashboard",
    loginTitle: "Log in",
    loginSubtitle: "Log in to your dashboard.",
    emailLabel: "Email address",
    emailPlaceholder: "name@company.com",
    submit: "Send login link",
    submitting: "Sending...",
    noPassword: "No password needed. Secure login through your email.",
    checkInbox: "Check your inbox",
    sentTo: "We have sent a login link to",
    linkValidity: "The link is valid for 15 minutes. Nothing received? Check your spam folder or",
    tryAgain: "try again",
    error: "Something went wrong. Please try again.",
  },
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<Lang>("nl");
  const router = useRouter();

  useEffect(() => {
    const browserLang = typeof navigator !== "undefined" ? navigator.language : "";
    if (!browserLang) return;
    const next: Lang = browserLang.toLowerCase().startsWith("nl") ? "nl" : "en";
    setLang(next);
    document.documentElement.lang = next;
  }, []);

  const c = COPY[lang];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error(c.error);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
            <div className="w-16 h-16 bg-accent-light rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">{c.checkInbox}</h1>
            <p className="text-muted-foreground mb-4">
              {c.sentTo} <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-sm text-muted">
              {c.linkValidity}{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-accent hover:underline"
              >
                {c.tryAgain}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo-light.svg"
            alt="Stevin.AI"
            className="h-8 w-auto"
          />
          <p className="text-muted-foreground mt-3">{c.welcome}</p>
        </div>

        <div className="bg-card border border-border p-8">
          <h2 className="text-lg font-semibold mb-1">{c.loginTitle}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {c.loginSubtitle}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                {c.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={c.emailPlaceholder}
                required
                autoFocus
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? c.submitting : c.submit}
            </button>
          </form>

          <p className="text-xs text-muted text-center mt-6">
            {c.noPassword}
          </p>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Powered by Stevin.AI
        </p>
      </div>
    </div>
  );
}
