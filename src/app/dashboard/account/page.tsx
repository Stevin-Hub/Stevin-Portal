"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { User, Package, MessageCircle, ShieldCheck, Mail, Crown, Users, GraduationCap, Lightbulb, Search, Shield, UserCheck } from "lucide-react";

interface AccountData {
  user: { id: string; email: string; displayName: string | null; role: string };
  client: {
    name: string;
    slug: string;
    consultant_name: string | null;
    consultant_email: string | null;
  } | null;
  package: {
    tier: string;
    service_category: string;
    monthly_fee: number;
    max_ad_spend: number;
    chat_tokens_limit: number;
  } | null;
  tokenUsage: { input: number; output: number; messages: number; total: number; limit: number };
  termsAccepted: boolean;
}

const ROLE_LABELS: Record<string, { label: string; icon: any }> = {
  admin: { label: "Admin (eigenaar)", icon: Crown },
  medewerker: { label: "Medewerker", icon: Users },
  stagiair: { label: "Stagiair", icon: GraduationCap },
};

const CATEGORY_LABELS: Record<string, string> = {
  paid_ads: "Paid Ads",
  seo_geo: "SEO & GEO",
  automation: "Automation",
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("nl-NL").format(n);
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function AccountPage() {
  return (
    <AuthGuard>
      {() => <AccountContent />}
    </AuthGuard>
  );
}

function AccountContent() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch<AccountData>("/account")
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const role = ROLE_LABELS[data.user.role] || { label: data.user.role, icon: User };
  const RoleIcon = role.icon;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-muted-foreground text-sm mt-1">Je profiel, pakket en gebruik</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Profile */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold">Profiel</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Naam</p>
              <p className="text-sm font-medium">{data.user.displayName || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted" />
                {data.user.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rol</p>
              <p className="text-sm font-medium flex items-center gap-2">
                <RoleIcon className="w-3.5 h-3.5 text-muted" />
                {role.label}
              </p>
            </div>
            {data.client && (
              <div>
                <p className="text-xs text-muted-foreground">Organisatie</p>
                <p className="text-sm font-medium">{data.client.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Package */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold">Pakket</h3>
          </div>
          {data.package ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Dienst</p>
                <p className="text-sm font-medium">
                  {CATEGORY_LABELS[data.package.service_category] || data.package.service_category}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tier</p>
                <p className="text-sm font-medium capitalize">{data.package.tier}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Maandelijks tarief</p>
                <p className="text-sm font-bold text-accent">{formatPrice(data.package.monthly_fee)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max. adspend</p>
                <p className="text-sm font-medium">{formatPrice(data.package.max_ad_spend)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen pakket gevonden</p>
          )}
        </div>

        {/* Berichten deze maand */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold">Berichten deze maand</h3>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-card-hover rounded-lg p-4 flex-1 text-center">
              <p className="text-3xl font-bold text-accent">{data.tokenUsage.messages}</p>
              <p className="text-sm text-muted-foreground mt-1">analyses via Stevin Assistant</p>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <h3 className="font-semibold">Voorwaarden</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${data.termsAccepted ? "bg-success" : "bg-warning"}`} />
            <p className="text-sm">
              {data.termsAccepted ? "Gebruiksvoorwaarden geaccepteerd" : "Gebruiksvoorwaarden nog niet geaccepteerd"}
            </p>
          </div>
        </div>
      </div>

      {/* Hoe werkt de Stevin Assistant? */}
      <div className="mt-6 bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-accent" />
          </div>
          <h3 className="font-semibold text-lg">Hoe werkt Stevin Assistant?</h3>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-card-hover rounded-lg p-4 flex gap-3">
            <MessageCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">Stel je vragen in gewone taal</p>
              <p className="text-sm text-muted-foreground">
                Je hoeft geen commando's te kennen. Vraag gewoon "Hoe liep Meta gisteren?" en Stevin duikt direct voor je in de data.
              </p>
            </div>
          </div>

          <div className="bg-card-hover rounded-lg p-4 flex gap-3">
            <Search className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">Jouw data-speurhond</p>
              <p className="text-sm text-muted-foreground">
                Stevin analyseert 24/7 je advertenties en zet de feiten razendsnel op een rij, zodat jij altijd overzicht hebt.
              </p>
            </div>
          </div>

          <div className="bg-card-hover rounded-lg p-4 flex gap-3">
            <UserCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">Jouw specialist blijft aan het roer</p>
              <p className="text-sm text-muted-foreground">
                Stevin geeft geen strategisch advies of tips. Hij zet de data klaar, en als er actie nodig is, roept hij direct jouw menselijke specialist erbij voor het strategische besluit.
              </p>
            </div>
          </div>

          <div className="bg-card-hover rounded-lg p-4 flex gap-3">
            <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">100% Europese Privacy</p>
              <p className="text-sm text-muted-foreground">
                Je data is veilig. We gebruiken uitsluitend Europese AI-servers, waardoor jouw bedrijfsgegevens nooit buiten de EU belanden en niet worden gebruikt voor externe trainingen.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
