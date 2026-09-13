"use client";

/**
 * De clickwrap van de portal (W-124). Spiegel van de Desk-gate: vier documenten,
 * een vinkje, en per document een POST naar /legal/accept, dat in het register
 * legal_acceptances schrijft (D-047: zonder geregistreerde acceptatie geen
 * verwerking). De Hub is fail closed: kan hij de documenttekst niet ophalen, dan
 * komt er geen rij en toont dit scherm de fout, met een knop om het opnieuw te
 * proberen.
 *
 * Tekenen kan alleen met een inloglink- of Google-account, want het register
 * hangt aan auth.users. Een klant met het oude portal-token krijgt daarom geen
 * vinkje maar de vraag om opnieuw in te loggen.
 */

import { useEffect, useState } from "react";
import { Lock, Loader2, CheckCircle2, LogIn } from "lucide-react";
import { portalFetch } from "@/lib/api";
import { clearAuth } from "@/lib/auth";
import { useLanguage, type Lang } from "@/lib/useLanguage";

interface LegalDoc {
  key: string;
  label: string;
  description: string;
  url: string;
  version: string;
  /** false = vrijwillig (W-128: gebruiksmeting). Ontbreekt het veld, dan verplicht. */
  is_required?: boolean;
}

interface Props {
  canSign: boolean;
  onAccepted: (uitkomst: { analyticsConsent: boolean }) => void;
}

// Terugval als de lijst niet laadt. Bron van waarheid blijft /legal/documents;
// de links wijzen naar stevin.ai, dezelfde teksten als waar de Hub zijn
// bewijsopname van maakt.
const FALLBACK_DOCS: LegalDoc[] = [
  { key: "terms_of_service", label: "Algemene Voorwaarden", description: "", url: "https://stevin.ai/terms", version: "" },
  { key: "privacy_policy", label: "Privacyverklaring", description: "", url: "https://stevin.ai/privacy", version: "" },
  { key: "data_processing_agreement", label: "Verwerkersovereenkomst", description: "", url: "https://stevin.ai/dpa", version: "" },
  { key: "nda", label: "Geheimhoudingsovereenkomst (NDA)", description: "", url: "https://stevin.ai/nda", version: "" },
];

const LABEL_EN: Record<string, string> = {
  terms_of_service: "Terms of Service",
  privacy_policy: "Privacy Policy",
  data_processing_agreement: "Data Processing Agreement",
  nda: "Non-Disclosure Agreement (NDA)",
};

const COPY: Record<Lang, {
  title: string; subtitle: string; agree: string; and: string; go: string; busy: string;
  fail: string; retry: string; legacyTitle: string; legacyBody: string; relogin: string; signedAs: string;
  meting: string; metingLink: string; metingNa: string;
}> = {
  nl: {
    title: "Nog een laatste stap",
    subtitle: "Lees en accepteer de afspraken voordat je verder gaat.",
    agree: "Ik ga akkoord met de",
    and: "en",
    go: "Aan de slag",
    busy: "Vastleggen...",
    fail: "De acceptatie kon niet worden vastgelegd. Er is niets opgeslagen. Probeer het opnieuw.",
    retry: "Opnieuw proberen",
    legacyTitle: "Opnieuw inloggen om te tekenen",
    legacyBody: "Je bent ingelogd met een oudere inlogmethode. Om de afspraken vast te leggen op je eigen account, log je eenmalig opnieuw in via je inloglink of met Google.",
    relogin: "Opnieuw inloggen",
    signedAs: "Ingelogd als",
    meting: "Ik geef toestemming om mijn gebruik van dit portaal te meten met Microsoft Clarity, met alle tekst en cijfers gemaskeerd. Dit is vrijwillig en staat los van de afspraken hierboven; intrekken kan altijd bij Account. Zie de",
    metingLink: "privacyverklaring",
    metingNa: ".",
  },
  en: {
    title: "One last step",
    subtitle: "Read and accept the agreements before you continue.",
    agree: "I agree to the",
    and: "and",
    go: "Get started",
    busy: "Saving...",
    fail: "The acceptance could not be recorded. Nothing was saved. Please try again.",
    retry: "Try again",
    legacyTitle: "Sign in again to accept",
    legacyBody: "You are signed in with an older method. To record the agreements on your own account, sign in once more via your login link or with Google.",
    relogin: "Sign in again",
    signedAs: "Signed in as",
    meting: "I allow my use of this portal to be measured with Microsoft Clarity, with all text and figures masked. This is voluntary and separate from the agreements above; you can withdraw it at any time under Account. See the",
    metingLink: "privacy policy",
    metingNa: ".",
  },
};

export default function ClickwrapGate({ canSign, onAccepted }: Props) {
  const lang = useLanguage();
  const c = COPY[lang];
  const [documents, setDocuments] = useState<LegalDoc[]>(FALLBACK_DOCS);
  const [checked, setChecked] = useState(false);
  // Vrijwillig en standaard UIT (W-128): toestemming voor opnames moet los van
  // de voorwaarden staan om als vrij gegeven te gelden.
  const [metingChecked, setMetingChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    portalFetch<{ documents?: LegalDoc[] }>("/legal/documents")
      .then((r) => { if (r?.documents?.length) setDocuments(r.documents); })
      .catch(() => { /* terugval staat al */ });
    portalFetch<{ user?: { email?: string } }>("/me")
      .then((me) => setEmail(me.user?.email ?? null))
      .catch(() => {});
  }, []);

  async function handleAccept() {
    if (!checked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Een POST per document; de Hub bepaalt zelf de geldende versie en maakt
      // per document een bewijsopname. Faalt er een, dan stoppen we en is er
      // voor dat document niets opgeslagen.
      for (const doc of verplicht) {
        await portalFetch("/legal/accept", {
          method: "POST",
          body: JSON.stringify({ document_type: doc.key }),
        });
      }
      // De vrijwillige toestemming alleen als het vinkje aan staat; zonder
      // vinkje komt er geen rij en dus geen meting.
      if (metingChecked) {
        for (const doc of vrijwillig) {
          await portalFetch("/legal/accept", {
            method: "POST",
            body: JSON.stringify({ document_type: doc.key }),
          });
        }
      }
      onAccepted({ analyticsConsent: metingChecked && vrijwillig.length > 0 });
    } catch {
      setError(c.fail);
      setSubmitting(false);
    }
  }

  function handleRelogin() {
    clearAuth();
    window.location.href = "/login";
  }

  const label = (d: LegalDoc) => (lang === "en" ? LABEL_EN[d.key] ?? d.label : d.label);
  const verplicht = documents.filter((d) => d.is_required !== false);
  const vrijwillig = documents.filter((d) => d.is_required === false);
  const privacyUrl = documents.find((d) => d.key === "privacy_policy")?.url ?? "https://stevin.ai/privacy";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        {!canSign ? (
          <>
            <h1 className="text-base font-semibold text-foreground">{c.legacyTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{c.legacyBody}</p>
            <button
              onClick={handleRelogin}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-muted"
            >
              <LogIn className="h-4 w-4" />
              {c.relogin}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-base font-semibold text-foreground">{c.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{c.subtitle}</p>

            <div
              role="checkbox"
              aria-checked={checked}
              tabIndex={0}
              onClick={() => setChecked((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") { e.preventDefault(); setChecked((v) => !v); }
              }}
              className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                checked ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/20"
              }`}
            >
              <div className="pt-0.5">
                <div className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-accent bg-accent text-white" : "border-border"}`}>
                  {checked && <CheckCircle2 className="h-3 w-3" />}
                </div>
              </div>
              <span className="text-sm text-foreground">
                {c.agree}{" "}
                {verplicht.map((doc, i) => (
                  <span key={doc.key}>
                    {i > 0 && i < verplicht.length - 1 && ", "}
                    {i === verplicht.length - 1 && ` ${c.and} `}
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {label(doc)}
                    </a>
                  </span>
                ))}
              </span>
            </div>

            {vrijwillig.length > 0 && (
              <div
                role="checkbox"
                aria-checked={metingChecked}
                tabIndex={0}
                onClick={() => setMetingChecked((v) => !v)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); setMetingChecked((v) => !v); }
                }}
                className={`mt-3 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  metingChecked ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/20"
                }`}
              >
                <div className="pt-0.5">
                  <div className={`flex h-4 w-4 items-center justify-center rounded border ${metingChecked ? "border-accent bg-accent text-white" : "border-border"}`}>
                    {metingChecked && <CheckCircle2 className="h-3 w-3" />}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {c.meting}{" "}
                  <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                    {c.metingLink}
                  </a>
                  {c.metingNa}
                </span>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <button
              onClick={handleAccept}
              disabled={!checked || submitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {submitting ? c.busy : error ? c.retry : c.go}
            </button>

            {email && <p className="mt-3 text-center text-xs text-muted-foreground">{c.signedAs} {email}</p>}
          </>
        )}
      </div>
    </div>
  );
}
