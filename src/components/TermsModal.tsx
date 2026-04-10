"use client";

import { useState } from "react";
import { portalFetch } from "@/lib/api";
import { toast } from "sonner";
import { ShieldCheck, FileText, ExternalLink } from "lucide-react";

interface TermsModalProps {
  onAccepted: () => void;
}

export default function TermsModal({ onAccepted }: TermsModalProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    if (!checked) return;
    setSubmitting(true);
    try {
      await portalFetch("/terms/accept", { method: "POST" });
      onAccepted();
    } catch (err: any) {
      toast.error(err.message || "Kon voorwaarden niet accepteren");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Gebruiksvoorwaarden</h2>
              <p className="text-sm text-muted-foreground">Lees en accepteer om verder te gaan</p>
            </div>
          </div>

          <div className="bg-card-hover border border-border-subtle rounded-xl p-4 text-sm text-muted-foreground space-y-4 mb-6 max-h-64 overflow-y-auto">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Stevin.AI Portaal — Gebruiksvoorwaarden
            </h3>

            <div>
              <p className="font-medium text-foreground mb-1">1. Toegang & Accounts</p>
              <p>
                Toegang tot het Stevin.AI portaal is strikt persoonlijk. Je bent verantwoordelijk voor het
                vertrouwelijk houden van je inloggegevens. Bij verlies of ongeautoriseerde toegang dien je
                dit direct te melden aan je consultant.
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">2. Gebruik van AI Chat</p>
              <p>
                De AI-assistent geeft inzichten op basis van je campagnedata. Deze adviezen zijn uitsluitend
                informatief en vormen geen garantie op specifieke resultaten. Je consultant blijft
                verantwoordelijk voor de uitvoering van je campagnestrategie. Stevin.AI is niet aansprakelijk
                voor beslissingen genomen op basis van AI-gegenereerde inzichten.
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">3. Gegevensverwerking</p>
              <p>
                Stevin.AI verwerkt campagne- en bedrijfsgegevens conform de AVG. Data wordt opgeslagen
                binnen de EU en uitsluitend gebruikt voor het leveren van onze diensten. We delen je
                gegevens niet met derden zonder je toestemming. Bij beeindiging van de samenwerking worden
                je gegevens binnen 30 dagen verwijderd, tenzij wettelijk anders vereist. Je hebt te allen
                tijde recht op inzage, correctie en verwijdering van je gegevens.
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">4. Aansprakelijkheid</p>
              <p>
                Het portaal wordt aangeboden op "as is"-basis zonder garantie op beschikbaarheid of
                foutloze werking. Stevin.AI is niet aansprakelijk voor directe of indirecte schade die
                voortvloeit uit het gebruik van het portaal, waaronder maar niet beperkt tot: onzorgvuldig
                gebruik, het delen van inloggegevens met derden, technische storingen, dataverlies, of
                beslissingen genomen op basis van getoonde data of AI-inzichten. De totale aansprakelijkheid
                van Stevin.AI is te allen tijde beperkt tot het bedrag van de laatst betaalde maandfactuur.
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">5. Budgetgoedkeuringen</p>
              <p>
                Goedkeuring van budgetvoorstellen via het portaal is bindend. Zorg dat de juiste persoon
                binnen je organisatie deze bevoegdheid heeft. Stevin.AI kan niet aansprakelijk worden
                gesteld voor goedgekeurde budgetten. Goedkeuringen kunnen niet achteraf worden ingetrokken
                indien de uitvoering reeds is gestart.
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">6. Intellectueel eigendom</p>
              <p>
                Het portaal, de onderliggende software, AI-modellen en gegenereerde rapportages zijn
                eigendom van Stevin.AI. Content en rapportages zijn uitsluitend bedoeld voor intern
                gebruik door de klant. Verspreiding, publicatie of reverse-engineering zonder
                schriftelijke toestemming is niet toegestaan.
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">7. Beschikbaarheid</p>
              <p>
                Stevin.AI streeft naar een hoge beschikbaarheid maar garandeert geen ononderbroken
                toegang. Gepland onderhoud wordt vooraf gecommuniceerd. Stevin.AI is niet aansprakelijk
                voor schade als gevolg van tijdelijke onbeschikbaarheid.
              </p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">8. Wijzigingen</p>
              <p>
                Stevin.AI behoudt het recht deze voorwaarden te wijzigen. Bij significante wijzigingen
                word je hierover geïnformeerd via het portaal of per e-mail. Voortgezet gebruik na
                kennisgeving geldt als acceptatie.
              </p>
            </div>

            <p className="text-xs text-muted pt-2 border-t border-border-subtle">
              Stevin.AI is een handelsnaam van WPOT B.V. Op deze voorwaarden is Nederlands recht van toepassing.
            </p>
          </div>

          <label className="flex items-start gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border accent-accent"
            />
            <span className="text-sm">
              Ik heb de gebruiksvoorwaarden gelezen en ga hiermee akkoord
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!checked || submitting}
            className="w-full py-3 bg-accent text-white font-medium rounded-xl hover:bg-accent-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Bezig..." : "Accepteren & Doorgaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
