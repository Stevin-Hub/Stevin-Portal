"use client";

import { useState } from "react";
import { Copy, Share2, RefreshCw, FileDown, Check } from "lucide-react";
import { toast } from "sonner";
import type { Lang } from "@/lib/useLanguage";

/**
 * De vier acties onder een antwoord van Stevin.
 *
 * De PDF gaat bewust NIET langs het model: hij neemt de HTML die de klant op
 * dit moment op zijn scherm heeft en laat de browser daar een PDF van maken.
 * Nul tokens, nul kosten, en de export is per definitie exact wat er stond.
 * Een tweede modelaanroep zou geld kosten en zou de tekst kunnen veranderen,
 * en dan klopt de PDF niet meer met wat de klant zag.
 */
interface Props {
  /** De ruwe markdown, voor kopieren en delen. */
  content: string;
  /** De vraag die eraan voorafging, voor de kop van de PDF. */
  question: string | null;
  /** Het opgemaakte antwoord zoals het op het scherm staat. */
  getRenderedHtml: () => string | null;
  clientName: string;
  lang: Lang;
  onRegenerate: (() => void) | null;
  busy: boolean;
}

const COPY = {
  nl: {
    copy: "Kopieren",
    copied: "Gekopieerd",
    share: "Delen",
    shared: "Gekopieerd om te delen",
    regenerate: "Opnieuw genereren",
    pdf: "Exporteren als PDF",
    pdfFailed: "De PDF kon niet worden geopend. Staat er een pop-upblokkering aan?",
    docTitle: "Analyse van Stevin",
    questionLabel: "Vraag",
    answerLabel: "Antwoord",
    dateLabel: "Gemaakt op",
    footer: "Dit antwoord is door AI opgesteld op basis van je eigen campagnedata.",
  },
  en: {
    copy: "Copy",
    copied: "Copied",
    share: "Share",
    shared: "Copied so you can share it",
    regenerate: "Regenerate",
    pdf: "Export as PDF",
    pdfFailed: "The PDF could not be opened. Is a pop-up blocker active?",
    docTitle: "Analysis by Stevin",
    questionLabel: "Question",
    answerLabel: "Answer",
    dateLabel: "Created on",
    footer: "This answer was written by AI, based on your own campaign data.",
  },
} as const;

/** Tekst in een HTML-document veilig neerzetten. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function ChatMessageActions({
  content,
  question,
  getRenderedHtml,
  clientName,
  lang,
  onRegenerate,
  busy,
}: Props) {
  const t = COPY[lang];
  const [copied, setCopied] = useState(false);

  async function toClipboard(text: string, melding: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success(melding);
    } catch {
      toast.error(t.pdfFailed);
    }
  }

  async function handleShare() {
    const tekst = question ? `${question}\n\n${content}` : content;
    // Web Share bestaat vooral op mobiel. Op desktop is het klembord de
    // eerlijkste vertaling van "delen": de klant plakt het waar hij wil.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: t.docTitle, text: tekst });
        return;
      } catch {
        // Afgebroken door de gebruiker of geweigerd: val terug op het klembord.
      }
    }
    await toClipboard(tekst, t.shared);
  }

  function handlePdf() {
    const html = getRenderedHtml();
    if (!html) {
      toast.error(t.pdfFailed);
      return;
    }

    const datum = new Date().toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const doc = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(t.docTitle)} - ${escapeHtml(clientName)}</title>
<style>
  @page { margin: 20mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         color: #1f2933; line-height: 1.55; font-size: 11pt; margin: 0; }
  header { border-bottom: 2px solid #3c8eff; padding-bottom: 10px; margin-bottom: 22px;
           display: flex; justify-content: space-between; align-items: baseline; }
  .merk { font-size: 15pt; font-weight: 700; letter-spacing: -0.01em; }
  .meta { font-size: 9pt; color: #64748b; text-align: right; }
  h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em;
       color: #64748b; margin: 0 0 6px; font-weight: 600; }
  .vraag { font-size: 12pt; font-weight: 600; margin: 0 0 22px; }
  .antwoord ul, .antwoord ol { margin: 0 0 10px 18px; padding: 0; }
  .antwoord li { margin-bottom: 3px; }
  .antwoord p { margin: 0 0 10px; }
  .antwoord strong { font-weight: 600; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #d6dde8;
           font-size: 8.5pt; color: #64748b; }
</style>
</head>
<body>
  <header>
    <span class="merk">Stevin.AI</span>
    <span class="meta">${escapeHtml(clientName)}<br>${escapeHtml(t.dateLabel)} ${escapeHtml(datum)}</span>
  </header>
  ${question ? `<h2>${escapeHtml(t.questionLabel)}</h2><p class="vraag">${escapeHtml(question)}</p>` : ""}
  <h2>${escapeHtml(t.answerLabel)}</h2>
  <div class="antwoord">${html}</div>
  <footer>${escapeHtml(t.footer)}</footer>
</body>
</html>`;

    // Via een verborgen iframe in plaats van window.open: dat wordt niet als
    // pop-up geblokkeerd en laat de klant op zijn eigen pagina staan.
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const venster = frame.contentWindow;
    if (!venster) {
      document.body.removeChild(frame);
      toast.error(t.pdfFailed);
      return;
    }

    venster.document.open();
    venster.document.write(doc);
    venster.document.close();

    // Even wachten tot de opmaak staat, anders print Safari een lege pagina.
    setTimeout(() => {
      try {
        venster.focus();
        venster.print();
      } catch {
        toast.error(t.pdfFailed);
      } finally {
        setTimeout(() => frame.remove(), 1000);
      }
    }, 250);
  }

  const knop =
    "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center gap-4 mt-2 ml-11">
      <button type="button" className={knop} onClick={() => toClipboard(content, t.copied)}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? t.copied : t.copy}
      </button>
      <button type="button" className={knop} onClick={handleShare}>
        <Share2 className="w-3.5 h-3.5" />
        {t.share}
      </button>
      {onRegenerate && (
        <button type="button" className={knop} onClick={onRegenerate} disabled={busy}>
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
          {t.regenerate}
        </button>
      )}
      <button type="button" className={knop} onClick={handlePdf}>
        <FileDown className="w-3.5 h-3.5" />
        {t.pdf}
      </button>
    </div>
  );
}
