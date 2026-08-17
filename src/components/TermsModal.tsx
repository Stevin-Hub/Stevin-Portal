"use client";

import { useState } from "react";
import { portalFetch } from "@/lib/api";
import { useLanguage, type Lang } from "@/lib/useLanguage";
import { toast } from "sonner";
import { ShieldCheck, FileText } from "lucide-react";

interface TermsModalProps {
  onAccepted: () => void;
}

interface Article {
  heading: string;
  body: string;
}

interface Copy {
  title: string;
  subtitle: string;
  docTitle: string;
  articles: Article[];
  footer: string;
  /** Alleen gevuld in vertaalde varianten: de Nederlandse tekst is de rechtsgeldige. */
  translationNote: string | null;
  consent: string;
  submitting: string;
  accept: string;
  error: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    title: "Gebruiksvoorwaarden",
    subtitle: "Lees en accepteer om verder te gaan",
    docTitle: "Stevin.AI Portaal: Gebruiksvoorwaarden",
    articles: [
      {
        heading: "1. Toegang & Accounts",
        body:
          "Toegang tot het Stevin.AI portaal is strikt persoonlijk. Je bent verantwoordelijk voor het " +
          "vertrouwelijk houden van je inloggegevens. Bij verlies of ongeautoriseerde toegang dien je " +
          "dit direct te melden aan je consultant.",
      },
      {
        heading: "2. Gebruik van AI Chat",
        body:
          "De AI-assistent geeft inzichten op basis van je campagnedata. Deze adviezen zijn uitsluitend " +
          "informatief en vormen geen garantie op specifieke resultaten. Je consultant blijft " +
          "verantwoordelijk voor de uitvoering van je campagnestrategie. Stevin.AI is niet aansprakelijk " +
          "voor beslissingen genomen op basis van AI-gegenereerde inzichten. Als uit je berichten " +
          "blijkt dat je ergens ontevreden over bent, kan het systeem daar automatisch een melding " +
          "van sturen aan je consultant, zodat die contact met je kan opnemen.",
      },
      {
        heading: "3. Gegevensverwerking",
        body:
          "Stevin.AI verwerkt campagne- en bedrijfsgegevens conform de AVG. Data wordt opgeslagen " +
          "binnen de EU en uitsluitend gebruikt voor het leveren van onze diensten. We delen je " +
          "gegevens niet met derden zonder je toestemming. Bij beeindiging van de samenwerking worden " +
          "je gegevens binnen 30 dagen verwijderd, tenzij wettelijk anders vereist. Je hebt te allen " +
          "tijde recht op inzage, correctie en verwijdering van je gegevens.",
      },
      {
        heading: "4. Aansprakelijkheid",
        body:
          'Het portaal wordt aangeboden op "as is"-basis zonder garantie op beschikbaarheid of ' +
          "foutloze werking. Stevin.AI is niet aansprakelijk voor directe of indirecte schade die " +
          "voortvloeit uit het gebruik van het portaal, waaronder maar niet beperkt tot: onzorgvuldig " +
          "gebruik, het delen van inloggegevens met derden, technische storingen, dataverlies, of " +
          "beslissingen genomen op basis van getoonde data of AI-inzichten. De totale aansprakelijkheid " +
          "van Stevin.AI is te allen tijde beperkt tot het bedrag van de laatst betaalde maandfactuur.",
      },
      {
        heading: "5. Budgetgoedkeuringen",
        body:
          "Goedkeuring van budgetvoorstellen via het portaal is bindend. Zorg dat de juiste persoon " +
          "binnen je organisatie deze bevoegdheid heeft. Stevin.AI kan niet aansprakelijk worden " +
          "gesteld voor goedgekeurde budgetten. Goedkeuringen kunnen niet achteraf worden ingetrokken " +
          "indien de uitvoering reeds is gestart.",
      },
      {
        heading: "6. Intellectueel eigendom",
        body:
          "Het portaal, de onderliggende software, AI-modellen en gegenereerde rapportages zijn " +
          "eigendom van Stevin.AI. Content en rapportages zijn uitsluitend bedoeld voor intern " +
          "gebruik door de klant. Verspreiding, publicatie of reverse-engineering zonder " +
          "schriftelijke toestemming is niet toegestaan.",
      },
      {
        heading: "7. Beschikbaarheid",
        body:
          "Stevin.AI streeft naar een hoge beschikbaarheid maar garandeert geen ononderbroken " +
          "toegang. Gepland onderhoud wordt vooraf gecommuniceerd. Stevin.AI is niet aansprakelijk " +
          "voor schade als gevolg van tijdelijke onbeschikbaarheid.",
      },
      {
        heading: "8. Wijzigingen",
        body:
          "Stevin.AI behoudt het recht deze voorwaarden te wijzigen. Bij significante wijzigingen " +
          "word je hierover geïnformeerd via het portaal of per e-mail. Voortgezet gebruik na " +
          "kennisgeving geldt als acceptatie.",
      },
    ],
    footer:
      "Stevin.AI is een handelsnaam van WPOT B.V. Op deze voorwaarden is Nederlands recht van toepassing.",
    translationNote: null,
    consent: "Ik heb de gebruiksvoorwaarden gelezen en ga hiermee akkoord",
    submitting: "Bezig...",
    accept: "Accepteren & Doorgaan",
    error: "Kon voorwaarden niet accepteren",
  },
  en: {
    title: "Terms of Use",
    subtitle: "Read and accept to continue",
    docTitle: "Stevin.AI Portal: Terms of Use",
    articles: [
      {
        heading: "1. Access & Accounts",
        body:
          "Access to the Stevin.AI portal is strictly personal. You are responsible for keeping your " +
          "login details confidential. In the event of loss or unauthorised access you must report " +
          "this to your consultant immediately.",
      },
      {
        heading: "2. Use of AI Chat",
        body:
          "The AI assistant provides insights based on your campaign data. This advice is purely " +
          "informative and is no guarantee of specific results. Your consultant remains responsible " +
          "for the execution of your campaign strategy. Stevin.AI is not liable for decisions taken " +
          "on the basis of AI-generated insights. If your messages show that you are dissatisfied " +
          "about something, the system can automatically send a notification about that to your " +
          "consultant, so that they can get in touch with you.",
      },
      {
        heading: "3. Data processing",
        body:
          "Stevin.AI processes campaign and company data in accordance with the GDPR. Data is stored " +
          "within the EU and used solely to deliver our services. We do not share your data with " +
          "third parties without your permission. When the collaboration ends, your data is deleted " +
          "within 30 days, unless the law requires otherwise. You have the right to access, correct " +
          "and delete your data at any time.",
      },
      {
        heading: "4. Liability",
        body:
          'The portal is offered on an "as is" basis without any guarantee of availability or ' +
          "faultless operation. Stevin.AI is not liable for direct or indirect damage arising from " +
          "the use of the portal, including but not limited to: careless use, sharing login details " +
          "with third parties, technical failures, data loss, or decisions taken on the basis of " +
          "displayed data or AI insights. The total liability of Stevin.AI is at all times limited " +
          "to the amount of the last monthly invoice paid.",
      },
      {
        heading: "5. Budget approvals",
        body:
          "Approval of budget proposals through the portal is binding. Make sure the right person " +
          "within your organisation holds this authority. Stevin.AI cannot be held liable for " +
          "approved budgets. Approvals cannot be withdrawn afterwards once execution has already " +
          "started.",
      },
      {
        heading: "6. Intellectual property",
        body:
          "The portal, the underlying software, AI models and generated reports are the property of " +
          "Stevin.AI. Content and reports are intended solely for internal use by the client. " +
          "Distribution, publication or reverse-engineering without written permission is not " +
          "allowed.",
      },
      {
        heading: "7. Availability",
        body:
          "Stevin.AI aims for high availability but does not guarantee uninterrupted access. Planned " +
          "maintenance is communicated in advance. Stevin.AI is not liable for damage resulting from " +
          "temporary unavailability.",
      },
      {
        heading: "8. Changes",
        body:
          "Stevin.AI reserves the right to change these terms. In the event of significant changes " +
          "you will be informed about this through the portal or by email. Continued use after " +
          "notification counts as acceptance.",
      },
    ],
    footer:
      "Stevin.AI is a trade name of WPOT B.V. Dutch law applies to these terms.",
    translationNote:
      "This is a translation for your convenience; the Dutch version is the legally binding one.",
    consent: "I have read the terms of use and I agree to them",
    submitting: "Working...",
    accept: "Accept and continue",
    error: "Could not accept the terms",
  },
};

export default function TermsModal({ onAccepted }: TermsModalProps) {
  const lang = useLanguage();
  const c = COPY[lang];
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    if (!checked) return;
    setSubmitting(true);
    try {
      await portalFetch("/terms/accept", { method: "POST" });
      onAccepted();
    } catch (err: any) {
      toast.error(err.message || c.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{c.title}</h2>
              <p className="text-sm text-muted-foreground">{c.subtitle}</p>
            </div>
          </div>

          <div className="bg-card-hover border border-border-subtle rounded-xl p-4 text-sm text-muted-foreground space-y-4 mb-6 max-h-64 overflow-y-auto">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {c.docTitle}
            </h3>

            {c.articles.map((article) => (
              <div key={article.heading}>
                <p className="font-medium text-foreground mb-1">{article.heading}</p>
                <p>{article.body}</p>
              </div>
            ))}

            <p className="text-xs text-muted pt-2 border-t border-border-subtle">
              {c.footer}
            </p>

            {c.translationNote && (
              <p className="text-xs text-muted">{c.translationNote}</p>
            )}
          </div>

          <label className="flex items-start gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border accent-accent"
            />
            <span className="text-sm">{c.consent}</span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!checked || submitting}
            className="w-full py-3 bg-accent text-white font-medium rounded-xl hover:bg-accent-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? c.submitting : c.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
