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
  .merk { height: 26px; width: auto; display: block; }
  .meta { font-size: 9pt; color: #64748b; text-align: right; }
  .vraag { font-size: 15pt; font-weight: 700; margin: 0 0 18px; letter-spacing: -0.01em; }
  .antwoord ul, .antwoord ol { margin: 0 0 10px 18px; padding: 0; }
  .antwoord li { margin-bottom: 3px; }
  .antwoord p { margin: 0 0 10px; }
  .antwoord strong { font-weight: 600; }
  .antwoord svg { width: 100%; height: auto; margin-top: 8px; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #d6dde8;
           font-size: 8.5pt; color: #64748b; }
</style>
</head>
<body>
  <header>
    <img class="merk" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNTc3LjQwNCAyNTMuNTAwIj4KPHJlY3Qgd2lkdGg9IjE1NzcuNDAiIGhlaWdodD0iMjUzLjUwIiBmaWxsPSIjMDAwMDAwMDAiLz4KPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTQ0LjczNSwtNTIuMTkxKSBzY2FsZSg3LjQ1NTg4KSIgZmlsbD0iIzNEOEVGRiI+CjxyZWN0IHg9IjYiIHk9IjciIHdpZHRoPSIzMCIgaGVpZ2h0PSIxNCIgcng9IjQiLz4KPHJlY3QgeD0iMTIiIHk9IjI3IiB3aWR0aD0iMzAiIGhlaWdodD0iMTQiIHJ4PSI0Ii8+CjwvZz4KPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMzg0LjcyNCwyNi4xNzcpIj4KPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTE1NC4wMDAwMDAsNDA1Ljk3MTA4OSkgc2NhbGUoMC4xMDAwMDAsLTAuMTAwMDAwKSIgZmlsbD0iIzBBMTYyOCIgc3Ryb2tlPSJub25lIj4KPHBhdGggZD0iTTIwMTUgNDA1NCBjLTIzNyAtMjggLTMzOSAtODQgLTQwOSAtMjIzIC01MSAtMTAxIC02MSAtMTYyIC02MCAtMzY2CjEgLTIwMSAxMSAtMjYxIDU1IC0zNDkgNTIgLTEwMyAxMDkgLTE0OSAyMzkgLTE5MiA0OSAtMTYgMTEwIC0xOCA1NDAgLTI0IDI2NwotMyA0OTMgLTkgNTAyIC0xNCAxMCAtNCAyOCAtMjQgNDAgLTQ0IDIxIC0zNCAyMyAtNDcgMjIgLTE4NyAtMSAtMTY1IC02IC0xODUKLTU3IC0yMTUgLTMxIC0xOSAtNTYgLTIwIC02NjkgLTIwIC02MjUgMCAtNjM4IDAgLTY1OCAtMjAgLTE4IC0xOCAtMjAgLTMzCi0yMCAtMTYzIDAgLTEwOCA0IC0xNDggMTQgLTE2MyAxNCAtMTggMzMgLTE5IDcwMyAtMTkgNjQwIDAgNjkyIDEgNzQ4IDE4IDg0CjI2IDEzMSA1MiAxODUgMTAzIDEwNSA5OCAxMzMgMTk5IDEzNCA0ODkgMSAyMTQgLTkgMjg3IC01MCAzODIgLTI3IDYxIC0xMDIKMTM5IC0xNjAgMTY0IC03MyAzMyAtMTcwIDM5IC02MjkgMzkgLTQwOCAwIC00NTMgMiAtNDg1IDE4IC01NiAyOCAtNzEgNzAgLTczCjIxNCAtMiAxMDggMSAxMjcgMTggMTU4IDQyIDcyIDE5IDcwIDcwMCA3MCA0NjIgMCA2MTQgMyA2MjMgMTIgOCA4IDEyIDU4IDEyCjE1OSAwIDEyMSAtMyAxNTAgLTE2IDE2MyAtMTQgMTQgLTgyIDE2IC02MTcgMTUgLTMzMSAtMSAtNjE1IC00IC02MzIgLTV6Ii8+CjxwYXRoIGQ9Ik03ODU4IDQwNDkgYy0xNiAtOSAtMTggLTI4IC0xOCAtMTYyIDAgLTEwNiA0IC0xNTcgMTIgLTE2NSAxNyAtMTcKMzE5IC0xNyAzMzYgMCA4IDggMTIgNTggMTIgMTU5IDAgMTIxIC0zIDE1MCAtMTYgMTYzIC0xMyAxMyAtNDIgMTYgLTE2MiAxNgotODEgMCAtMTU1IC01IC0xNjQgLTExeiIvPgo8cGF0aCBkPSJNMzcwMyAzOTAzIGMtMTAgLTMgLTEzIC01MCAtMTMgLTE4NCBsMCAtMTc5IC0xMjggMCBjLTg2IDAgLTEzMiAtNAotMTQwIC0xMiAtMTcgLTE3IC0xNyAtMjY5IDAgLTI4NiA4IC04IDU0IC0xMiAxMzkgLTEyIGwxMjggMCAzIC00MzcgYzMgLTQyMgo0IC00NDAgMjYgLTUwNSAyNSAtNzUgOTEgLTE1NyAxNTEgLTE4OCA2NyAtMzQgMTgwIC01MCAzNTAgLTUwIDg4IDAgMTcxIDQKMTg1IDEwIGwyNiAxMCAwIDEzMyBjMCA5MCAtNCAxMzcgLTEyIDE0NSAtOCA4IC01NCAxMiAtMTQwIDEyIC0yMzAgMCAtMjIyCi0xOCAtMjI2IDQ4OCBsLTMgMzgyIDE3NSAwIGM5NiAwIDE4MSAzIDE5MCA2IDE0IDUgMTYgMjggMTYgMTQ1IDAgMTI2IC0yIDEzOQotMTkgMTQ5IC0xMiA2IC05MiAxMCAtMTkwIDEwIGwtMTcxIDAgMCAxNzMgYzAgMTIxIC00IDE3NyAtMTIgMTg1IC0xMiAxMgotMzA3IDE3IC0zMzUgNXoiLz4KPHBhdGggZD0iTTQ5NDUgMzUzMyBjLTE2NSAtMjMgLTI4MiAtMTEwIC0zMzQgLTI0OSAtMzggLTEwMCAtNDYgLTE4NyAtNDYKLTQ5NCAwIC0yMzggNCAtMzEyIDE3IC0zODUgMzcgLTE4OSAxMjQgLTI4NSAzMDAgLTMzMiA1NCAtMTQgMTM3IC0xNyA1NTkgLTIwCjI3MyAtMyA1MTEgMCA1MzAgNCBsMzQgOSAzIDE0MyBjMiA5NSAtMSAxNDggLTkgMTU3IC05IDExIC0xMDMgMTQgLTQ5MiAxNgotNDYzIDMgLTQ4MyA0IC01MTcgMjMgLTQ5IDI5IC02OSA3NSAtNzYgMTgzIGwtNyA5MSA1MTQgMyBjNDc2IDMgNTE2IDQgNTQwCjIxIDUyIDM1IDc0IDE0MCA3MyAzNDIgLTEgMjE3IC0yMiAyOTkgLTEwMCAzNzkgLTk0IDk3IC0yMDQgMTE3IC02MzggMTE1Ci0xNzYgLTEgLTMzNCAtNCAtMzUxIC02eiBtNjc2IC0zMjAgYzE2IC0xMCAzOSAtMzcgNTAgLTYxIDE4IC0zNiAyMSAtNTcgMTcKLTEyMSAtMiAtNDIgLTggLTgzIC0xMiAtODkgLTUgLTkgLTEwNCAtMTIgLTM4NyAtMTIgbC0zNzkgMCAwIDMzIGMxIDY0IDIwCjE3OCAzNSAyMDcgMzAgNTcgNDIgNTkgMzU4IDYwIDI1NiAwIDI5MiAtMiAzMTggLTE3eiIvPgo8cGF0aCBkPSJNNjA4NSAzNTMwIGMtMyAtNSAtMiAtMjUgMyAtNDMgOCAtMjggMjE5IC01NjIgMzkyIC05OTIgMjYgLTY2IDYyCi0xNTYgNzkgLTIwMCAxOCAtNDQgNDYgLTEwOSA2NCAtMTQ1IDQ4IC05NyA2MSAtMTAyIDI3NCAtOTggMTU1IDMgMTc1IDUgMjAwCjI0IDI5IDIyIDQ1IDU1IDE1MyAzMjQgMzQgODUgODkgMjE5IDEyMSAyOTcgMzIgNzggNTkgMTQ1IDU5IDE0OCAwIDQgMjkgNzcKNjQgMTYzIDE0NCAzNTMgMTk2IDQ4OCAxOTYgNTEwIDAgMjIgMCAyMiAtMTc5IDIyIC0xMzEgMCAtMTgxIC0zIC0xODkgLTEyIC02Ci03IC00MiAtOTYgLTgyIC0xOTggLTM5IC0xMDIgLTk1IC0yNDggLTEyNSAtMzI1IC0zMCAtNzcgLTc5IC0yMDUgLTExMCAtMjg1Ci0zMSAtODAgLTY3IC0xNzQgLTgxIC0yMDkgLTMyIC04NyAtNDAgLTkzIC02MCAtNDUgLTIxIDQ5IC0xMTUgMjk0IC0yMDQgNTI5Ci0xMzggMzY2IC0xOTcgNTEzIC0yMTIgNTMzIC0xMyAxNSAtMzUzIDE4IC0zNjMgMnoiLz4KPHBhdGggZD0iTTc4NTIgMzUyOCBjLTkgLTkgLTEyIC0xODUgLTEyIC03MzAgbDAgLTcxOCAyNCAtMTYgYzM1IC0yMiAzMTIgLTE3CjMyNiA2IDE1IDI0IDEzIDE0NDMgLTIgMTQ1OCAtOCA4IC02MCAxMiAtMTY4IDEyIC0xMDggMCAtMTYwIC00IC0xNjggLTEyeiIvPgo8cGF0aCBkPSJNODQ0NSAzNTMxIGMtNTAgLTIxIC00OCA0IC00OSAtNzM2IC0xIC0zODIgMiAtNzA0IDYgLTcxNSA3IC0xOSAxNgotMjAgMTY2IC0yMCAxMjEgMCAxNjIgMyAxNzEgMTMgOCAxMCAxMiAxODMgMTMgNTgzIGwzIDU2OSAyNTAgMyBjMjkyIDQgMzYzCi01IDQzMyAtNTEgMzUgLTI0IDUyIC00NCA2NyAtODIgMTkgLTQ3IDIwIC03NSAyMyAtNTMwIDIgLTMyMyA2IC00ODMgMTQgLTQ5MgoxNCAtMTggMzE4IC0xOSAzMzYgLTEgOSA5IDEyIDEzOSAxMiA1MjMgMCA0NzQgLTEgNTE3IC0xOSA1ODggLTQ4IDE4NyAtMTM1CjI3NyAtMzE2IDMyOSAtNzggMjIgLTk0IDIyIC01ODUgMjUgLTI3OCAxIC01MTQgLTIgLTUyNSAtNnoiLz4KPC9nPgo8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTU0LjAwMDAwMCw0MDUuOTcxMDg5KSBzY2FsZSgwLjEwMDAwMCwtMC4xMDAwMDApIiBmaWxsPSIjM0Q4RUZGIiBzdHJva2U9Im5vbmUiPgo8cGF0aCBkPSJNMTE3MDEgNDA0OSBjLTgzIC0xNiAtODUgLTIwIC0xODkgLTI2NCAtMzMgLTc3IC04MSAtMTg5IC0xMDcgLTI1MAotMjYgLTYwIC03OSAtMTg0IC0xMTcgLTI3NSAtMzkgLTkxIC04NSAtMTk5IC0xMDMgLTI0MCAtMTcgLTQxIC01OCAtMTM2IC05MAotMjEwIC0zMiAtNzQgLTgyIC0xOTEgLTExMyAtMjYwIC0zMCAtNjkgLTYwIC0xNDEgLTY3IC0xNjAgLTcgLTE5IC0yNSAtNjIKLTQwIC05NSAtMzkgLTg2IC05NSAtMjI2IC05NSAtMjM3IDAgLTE0IDM5NSAtOSA0MTQgNSA5IDcgNDggOTEgODcgMTg3IDM5IDk2Cjc4IDE5MiA4NyAyMTMgbDE1IDM3IDQ3NyAwIDQ3NiAwIDMxIC03NyBjODMgLTIwNCAxNDQgLTM0NyAxNTUgLTM2MCA5IC0xMSA1MgotMTMgMjA5IC0xMyAxMDkgMSAyMDEgNSAyMDMgOCA0IDcgLTU5IDE2NCAtMTgxIDQ1MiAtMTIwIDI4MSAtMTUzIDM2MCAtMjE0CjUwNSAtMzIgNzcgLTg5IDIxNCAtMTI3IDMwNSAtNjkgMTYzIC0xNDUgMzQ3IC0yMzcgNTY4IC01MiAxMjUgLTcxIDE0NSAtMTQ2CjE2MSAtNTggMTMgLTI2NCAxMyAtMzI4IDB6IG0yMTMgLTUwMSBjODYgLTIwNCAxNTEgLTM2NCAxNzYgLTQzMyAxMCAtMjcgMzkKLTk4IDYzIC0xNTcgMjQgLTU5IDQyIC0xMTAgMzkgLTExMyAtMyAtMyAtMTUzIC01IC0zMzQgLTUgLTI1NiAwIC0zMjggMyAtMzI4CjEzIDAgMTEgNDMgMTIwIDIwNyA1MjIgMzYgODggNzYgMTg4IDkwIDIyMyAxNCAzNCAyOCA2MiAzMyA2MiA0IDAgMjkgLTUxIDU0Ci0xMTJ6Ii8+CjxwYXRoIGQ9Ik0xMzA4MCA0MDMxIGMtMTEgLTIyIC0xMyAtMTg0NCAtMiAtMTkyMSBsNyAtNDUgMTc1IC0yIGMxMDAgLTIgMTgxCjEgMTkwIDcgMTMgOCAxNSAxMjggMTcgOTcxIDEgNTQzIC0zIDk3MiAtOCA5ODYgLTggMjMgLTkgMjMgLTE4OCAyMyAtMTY4IDAKLTE4MSAtMSAtMTkxIC0xOXoiLz4KPHBhdGggZD0iTTEwMjcwIDI1NjkgYy0yMDcgLTkzIC0yMTIgLTM5MSAtOCAtNDkzIDc1IC0zOCAxNzUgLTM3IDI0OSAyIDEwMwo1NCAxNjYgMTg1IDE0MCAyOTUgLTIwIDg5IC05MiAxNzUgLTE2OSAyMDMgLTU3IDIwIC0xNTkgMTcgLTIxMiAtN3oiLz4KPC9nPgo8L2c+Cjwvc3ZnPg==" alt="Stevin.AI">
    <span class="meta">${escapeHtml(clientName)}<br>${escapeHtml(t.dateLabel)} ${escapeHtml(datum)}</span>
  </header>
  ${question ? `<h1 class="vraag">${escapeHtml(question)}</h1>` : ""}
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
