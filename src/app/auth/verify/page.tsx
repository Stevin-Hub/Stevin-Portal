"use client";

/**
 * /auth/verify, wisselt een magic-link-token om voor een sessie.
 *
 * De klanttaal uit clients.advisor_language is hier nog niet bekend, want er
 * is nog geen sessie. Daarom kiest dit scherm op de browsertaal, precies zoals
 * het inlogscherm: begint navigator.language met "nl", dan Nederlands, anders
 * Engels. Weet de browser niets, dan blijft het Nederlands.
 *
 * De keuze staat bewust in een effect en niet in de eerste render, zodat
 * server en client dezelfde HTML opleveren. In datzelfde effect gaat ook
 * document.documentElement.lang mee, want de root-layout zet lang="nl" en dit
 * scherm valt buiten het dashboard.
 */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { portalFetch } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import type { Lang } from "@/lib/useLanguage";

interface Copy {
  loading: string;
  noLink: string;
  expired: string;
  inactive: string;
  title: string;
  loginAgain: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    loading: "Bezig met inloggen...",
    noLink: "Geen geldige link.",
    expired: "Link is verlopen of ongeldig.",
    inactive: "Dit account staat niet meer actief. Neem contact op met je consultant.",
    title: "Link niet geldig",
    loginAgain: "Opnieuw inloggen",
  },
  en: {
    loading: "Signing you in...",
    noLink: "This link is not valid.",
    expired: "This link has expired or is not valid.",
    inactive: "This account is no longer active. Please contact your consultant.",
    title: "Link not valid",
    loginAgain: "Log in again",
  },
};

/** Taal op de browsertaal, zoals het inlogscherm dat doet. */
function useBrowserLang(): Lang {
  const [lang, setLang] = useState<Lang>("nl");

  useEffect(() => {
    const browserLang = typeof navigator !== "undefined" ? navigator.language : "";
    if (!browserLang) return;
    const next: Lang = browserLang.toLowerCase().startsWith("nl") ? "nl" : "en";
    setLang(next);
    document.documentElement.lang = next;
  }, []);

  return lang;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <VerifyContent />
    </Suspense>
  );
}

function LoadingSpinner() {
  const lang = useBrowserLang();
  const c = COPY[lang];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">{c.loading}</p>
      </div>
    </div>
  );
}

function VerifyContent() {
  const [status, setStatus] = useState<"loading" | "no-link" | "failed" | "inactive">("loading");
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useBrowserLang();
  const c = COPY[lang];

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("no-link");
      return;
    }

    portalFetch<{ token: string; user: any; client: any }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        setAuth(data.token, data.user, data.client);
        router.replace("/dashboard");
      })
      .catch((err) => {
        // De servertekst staat vast in de taal van de Hub, en die kent de
        // klanttaal hier nog niet. Daarom vertalen we zelf, op de code.
        setStatus(err?.code === "account_not_active" ? "inactive" : "failed");
      });
  }, [searchParams, router]);

  if (status !== "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 bg-danger-light rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">{c.title}</h1>
          <p className="text-muted-foreground mb-4">
            {status === "no-link" ? c.noLink : status === "inactive" ? c.inactive : c.expired}
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition"
          >
            {c.loginAgain}
          </a>
        </div>
      </div>
    );
  }

  return <LoadingSpinner />;
}
