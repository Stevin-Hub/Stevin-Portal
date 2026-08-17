"use client";

/**
 * /auth/one-click, wisselt een deep-link-token om voor een sessie.
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
import type { Lang } from "@/lib/useLanguage";

interface Copy {
  loading: string;
  noLink: string;
  expired: string;
  inactive: string;
  title: string;
  login: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    loading: "Even geduld...",
    noLink: "Geen geldige link.",
    expired: "Link is verlopen of al gebruikt.",
    inactive: "Dit account staat niet meer actief. Neem contact op met je consultant.",
    title: "Link niet geldig",
    login: "Inloggen",
  },
  en: {
    loading: "One moment...",
    noLink: "This link is not valid.",
    expired: "This link has expired or has already been used.",
    inactive: "This account is no longer active. Please contact your consultant.",
    title: "Link not valid",
    login: "Log in",
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

export default function OneClickPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OneClickContent />
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

function OneClickContent() {
  const [status, setStatus] = useState<"loading" | "no-link" | "failed" | "inactive">("loading");
  // Alleen de melding van de server. De eigen tekst komt pas bij het renderen
  // uit COPY, want in dit effect staat de taalkeuze nog op de eerste render.
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

    portalFetch<{ token: string; redirect: string }>("/auth/one-click", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => {
        localStorage.setItem("stevin-portal-token", data.token);
        router.replace(data.redirect || "/dashboard");
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
          <h1 className="text-xl font-bold mb-2">{c.title}</h1>
          <p className="text-muted-foreground mb-4">
            {status === "no-link" ? c.noLink : status === "inactive" ? c.inactive : c.expired}
          </p>
          <a href="/login" className="inline-block px-6 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent-muted transition">
            {c.login}
          </a>
        </div>
      </div>
    );
  }

  return <LoadingSpinner />;
}
