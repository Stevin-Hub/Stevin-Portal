"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { User, Package, MessageCircle, ShieldCheck, Mail, Crown, Users, GraduationCap, Lightbulb, Search, Shield, UserCheck } from "lucide-react";
import { useLanguage, localeFor, type Lang } from "@/lib/useLanguage";

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

const ROLE_LABELS: Record<string, { label: Record<Lang, string>; icon: any }> = {
  admin: { label: { nl: "Admin (eigenaar)", en: "Admin (owner)" }, icon: Crown },
  medewerker: { label: { nl: "Medewerker", en: "Employee" }, icon: Users },
  stagiair: { label: { nl: "Stagiair", en: "Intern" }, icon: GraduationCap },
};

const CATEGORY_LABELS: Record<string, string> = {
  paid_ads: "Paid Ads",
  seo_geo: "SEO & GEO",
  automation: "Automation",
};

interface AccountCopy {
  intro: string;
  fallbackName: string;
  profile: string;
  name: string;
  email: string;
  role: string;
  organisation: string;
  packageTitle: string;
  service: string;
  tier: string;
  monthlyFee: string;
  maxAdSpend: string;
  noPackage: string;
  questionsTitle: string;
  questionsCaption: string;
  termsTitle: string;
  termsAccepted: string;
  termsPending: string;
  explainerTitle: string;
  plainLanguageTitle: string;
  plainLanguageBody: string;
  factsTitle: string;
  factsBody: string;
  specialistTitle: string;
  specialistBody: string;
  privacyTitle: string;
  privacyBody: string;
}

const COPY: Record<Lang, AccountCopy> = {
  nl: {
    intro: "Wie toegang heeft, wat gekoppeld is en waar afspraken vastliggen.",
    fallbackName: "Stevin App",
    profile: "Profiel",
    name: "Naam",
    email: "E-mail",
    role: "Rol",
    organisation: "Organisatie",
    packageTitle: "Pakket",
    service: "Dienst",
    tier: "Tier",
    monthlyFee: "Maandelijks tarief",
    maxAdSpend: "Max. adspend",
    noPackage: "Geen pakket gevonden",
    questionsTitle: "Vragen deze maand",
    questionsCaption: "vragen via Stevin",
    termsTitle: "Voorwaarden",
    termsAccepted: "Gebruiksvoorwaarden geaccepteerd",
    termsPending: "Gebruiksvoorwaarden nog niet geaccepteerd",
    explainerTitle: "Wat doet Stevin hier?",
    plainLanguageTitle: "Stel je vragen in gewone taal",
    plainLanguageBody:
      "Je hoeft geen commando's te kennen. Vraag gewoon \"Hoe liep Meta gisteren?\" en Stevin duikt direct voor je in de data.",
    factsTitle: "Alle feiten op een rij",
    factsBody:
      "Stevin zet campagne-, budget- en meetdata naast elkaar, zodat je ziet waar iets schuift.",
    specialistTitle: "Jouw specialist blijft aan het roer",
    specialistBody:
      "Stevin geeft geen strategisch advies of tips. Hij zet de data klaar, en als er actie nodig is, roept hij direct jouw menselijke specialist erbij voor het strategische besluit.",
    privacyTitle: "100% Europese Privacy",
    privacyBody:
      "Je data is veilig. We gebruiken uitsluitend Europese AI-servers, waardoor jouw bedrijfsgegevens nooit buiten de EU belanden en niet worden gebruikt voor externe trainingen.",
  },
  en: {
    intro: "Who has access, what is connected and where the agreements are recorded.",
    fallbackName: "Stevin App",
    profile: "Profile",
    name: "Name",
    email: "Email",
    role: "Role",
    organisation: "Organisation",
    packageTitle: "Package",
    service: "Service",
    tier: "Tier",
    monthlyFee: "Monthly fee",
    maxAdSpend: "Max. ad spend",
    noPackage: "No package found",
    questionsTitle: "Questions this month",
    questionsCaption: "questions via Stevin",
    termsTitle: "Terms",
    termsAccepted: "Terms of use accepted",
    termsPending: "Terms of use not accepted yet",
    explainerTitle: "What does Stevin do here?",
    plainLanguageTitle: "Ask your questions in plain language",
    plainLanguageBody:
      "You do not need to know any commands. Just ask \"How did Meta do yesterday?\" and Stevin dives straight into the data for you.",
    factsTitle: "All the facts side by side",
    factsBody:
      "Stevin puts campaign, budget and measurement data next to each other, so you can see where something shifts.",
    specialistTitle: "Your specialist stays in charge",
    specialistBody:
      "Stevin does not give strategic advice or tips. He prepares the data, and when action is needed he brings in your human specialist for the strategic decision.",
    privacyTitle: "100% European privacy",
    privacyBody:
      "Your data is safe. We use European AI servers only, so your company data never leaves the EU and is never used for external training.",
  },
};

function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(localeFor(lang)).format(n);
}

function formatPrice(n: number, lang: Lang): string {
  return new Intl.NumberFormat(localeFor(lang), { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
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
  const lang = useLanguage();
  const c = COPY[lang];

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

  const role = ROLE_LABELS[data.user.role];
  const roleLabel = role ? role.label[lang] : data.user.role;
  const RoleIcon = role ? role.icon : User;

  return (
    <div className="space-y-7">
      <header className="rounded-[36px] border border-border bg-card p-8 shadow-[0_20px_60px_rgba(31,41,51,0.05)]">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-muted-foreground">
          {data.client?.name || c.fallbackName}
        </p>
        <h1 className="mt-3 text-[clamp(3rem,6vw,5.2rem)] font-black leading-none tracking-[-0.075em]">
          Account
        </h1>
        <p className="mt-4 max-w-2xl text-[clamp(1.2rem,2vw,1.8rem)] leading-tight tracking-[-0.035em] text-muted-foreground">
          {c.intro}
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Profile */}
        <div className="rounded-[28px] border border-border bg-card p-7 shadow-[0_18px_45px_rgba(31,41,51,0.045)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light">
              <User className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-black tracking-[-0.035em]">{c.profile}</h3>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">{c.name}</p>
              <p className="text-sm font-medium">{data.user.displayName || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.email}</p>
              <p className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted" />
                {data.user.email}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.role}</p>
              <p className="text-sm font-medium flex items-center gap-2">
                <RoleIcon className="w-3.5 h-3.5 text-muted" />
                {roleLabel}
              </p>
            </div>
            {data.client && (
              <div>
                <p className="text-xs text-muted-foreground">{c.organisation}</p>
                <p className="text-sm font-medium">{data.client.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Package */}
        <div className="rounded-[28px] border border-border bg-card p-7 shadow-[0_18px_45px_rgba(31,41,51,0.045)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light">
              <Package className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-black tracking-[-0.035em]">{c.packageTitle}</h3>
          </div>
          {data.package ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">{c.service}</p>
                <p className="text-sm font-medium">
                  {CATEGORY_LABELS[data.package.service_category] || data.package.service_category}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.tier}</p>
                <p className="text-sm font-medium capitalize">{data.package.tier}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.monthlyFee}</p>
                <p className="text-sm font-bold text-accent">{formatPrice(data.package.monthly_fee, lang)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.maxAdSpend}</p>
                <p className="text-sm font-medium">{formatPrice(data.package.max_ad_spend, lang)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{c.noPackage}</p>
          )}
        </div>

        {/* Berichten deze maand */}
        <div className="rounded-[28px] border border-border bg-card p-7 shadow-[0_18px_45px_rgba(31,41,51,0.045)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light">
              <MessageCircle className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-black tracking-[-0.035em]">{c.questionsTitle}</h3>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-page p-5 flex-1 text-center">
              <p className="text-3xl font-bold text-accent">{formatNumber(data.tokenUsage.messages, lang)}</p>
              <p className="text-sm text-muted-foreground mt-1">{c.questionsCaption}</p>
            </div>
          </div>
        </div>

        {/* Terms */}
        <div className="rounded-[28px] border border-border bg-card p-7 shadow-[0_18px_45px_rgba(31,41,51,0.045)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-black tracking-[-0.035em]">{c.termsTitle}</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${data.termsAccepted ? "bg-success" : "bg-warning"}`} />
            <p className="text-sm">
              {data.termsAccepted ? c.termsAccepted : c.termsPending}
            </p>
          </div>
        </div>
      </div>

      {/* Hoe werkt de Stevin Assistant? */}
      <div className="rounded-[32px] border border-border bg-card p-7 shadow-[0_18px_45px_rgba(31,41,51,0.045)]">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-light">
            <Lightbulb className="w-5 h-5 text-accent" />
          </div>
          <h3 className="text-2xl font-black tracking-[-0.045em]">{c.explainerTitle}</h3>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex gap-3 rounded-2xl bg-page p-5">
            <MessageCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">{c.plainLanguageTitle}</p>
              <p className="text-sm text-muted-foreground">{c.plainLanguageBody}</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl bg-page p-5">
            <Search className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">{c.factsTitle}</p>
              <p className="text-sm text-muted-foreground">{c.factsBody}</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl bg-page p-5">
            <UserCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">{c.specialistTitle}</p>
              <p className="text-sm text-muted-foreground">{c.specialistBody}</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-2xl bg-page p-5">
            <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-1">{c.privacyTitle}</p>
              <p className="text-sm text-muted-foreground">{c.privacyBody}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
