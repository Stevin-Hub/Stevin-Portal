"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { useLanguage, localeFor, type Lang } from "@/lib/useLanguage";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { Package, Star, Check, ArrowRight, Sparkles, TrendingUp, Zap } from "lucide-react";

interface Tier {
  tier: string;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  popular?: boolean;
}

interface ServiceCategory {
  name: string;
  tiers: Tier[];
}

interface Recommendation {
  category: string;
  name: string;
  reason: string;
  startingPrice: number;
}

interface ServicesData {
  currentPackage: {
    tier: string;
    service_category: string;
    monthly_fee: number;
    max_ad_spend: number;
    chat_tokens_limit: number;
  } | null;
  services: Record<string, ServiceCategory>;
  recommendations: Recommendation[];
}

interface Copy {
  title: string;
  subtitle: string;
  currentPackage: string;
  perMonth: string;
  perMonthShort: string;
  packages: string;
  current: string;
  popular: string;
  upgrade: string;
  upgradeToast: string;
  recommended: string;
  startingFrom: string;
  moreInfo: string;
  moreInfoToast: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    title: "Diensten",
    subtitle: "Je huidige pakket en mogelijkheden om te groeien",
    currentPackage: "Je huidige pakket",
    perMonth: "per maand",
    perMonthShort: "/mnd",
    packages: "Pakketten",
    current: "Huidig",
    popular: "Populair",
    upgrade: "Upgraden",
    upgradeToast: "Neem contact op met je consultant om te upgraden",
    recommended: "Aanbevolen voor jou",
    startingFrom: "Vanaf",
    moreInfo: "Meer informatie",
    moreInfoToast: "Neem contact op met je consultant om dit te bespreken",
  },
  en: {
    title: "Services",
    subtitle: "Your current package and ways to grow",
    currentPackage: "Your current package",
    perMonth: "per month",
    perMonthShort: "/mo",
    packages: "Packages",
    current: "Current",
    popular: "Popular",
    upgrade: "Upgrade",
    upgradeToast: "Contact your consultant to upgrade",
    recommended: "Recommended for you",
    startingFrom: "From",
    moreInfo: "More information",
    moreInfoToast: "Contact your consultant to discuss this",
  },
};

const CATEGORY_ICONS: Record<string, any> = {
  paid_ads: TrendingUp,
  seo_geo: Sparkles,
  automation: Zap,
};

const CATEGORY_LABELS: Record<string, string> = {
  paid_ads: "Paid Ads",
  seo_geo: "SEO & GEO",
  automation: "Automation",
};

function formatPrice(n: number, lang: Lang): string {
  return new Intl.NumberFormat(localeFor(lang), { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function ServicesPage() {
  return (
    <AuthGuard>
      {() => <ServicesContent />}
    </AuthGuard>
  );
}

function ServicesContent() {
  const lang = useLanguage();
  const c = COPY[lang];
  const [data, setData] = useState<ServicesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    portalFetch<ServicesData>("/services")
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

  const currentCat = data.currentPackage?.service_category || "paid_ads";
  const currentTier = data.currentPackage?.tier || "starter";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{c.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{c.subtitle}</p>
      </div>

      {/* Current package */}
      {data.currentPackage && (
        <div className="bg-card border border-accent/30 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.currentPackage}</p>
              <h3 className="font-bold text-lg">
                {CATEGORY_LABELS[currentCat]} ({currentTier.charAt(0).toUpperCase() + currentTier.slice(1)})
              </h3>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-accent">{formatPrice(data.currentPackage.monthly_fee, lang)}</p>
              <p className="text-xs text-muted-foreground">{c.perMonth}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current service tiers (upgrade path) */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold mb-4">{CATEGORY_LABELS[currentCat]}: {c.packages}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {data.services[currentCat]?.tiers.map((t) => {
            const isCurrent = t.tier === currentTier;
            const isUpgrade = !isCurrent && (
              (t.tier === "professional" && currentTier === "starter") ||
              (t.tier === "enterprise" && (currentTier === "starter" || currentTier === "professional"))
            );

            return (
              <div
                key={t.tier}
                className={`bg-card border rounded-xl p-5 relative ${
                  isCurrent ? "border-accent ring-1 ring-accent/30" : "border-border"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-4 px-3 py-0.5 bg-accent text-white text-xs font-medium rounded-full">
                    {c.current}
                  </div>
                )}
                {t.popular && !isCurrent && (
                  <div className="absolute -top-3 left-4 px-3 py-0.5 bg-accent/20 text-accent text-xs font-medium rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> {c.popular}
                  </div>
                )}
                <h3 className="font-bold mt-1">{t.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{t.tagline}</p>
                <p className="text-2xl font-bold mb-4">
                  {formatPrice(t.price, lang)}<span className="text-sm font-normal text-muted-foreground">{c.perMonthShort}</span>
                </p>
                <ul className="space-y-2 mb-5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isUpgrade && (
                  <button
                    onClick={() => toast.info(c.upgradeToast)}
                    className="w-full py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition flex items-center justify-center gap-2"
                  >
                    {c.upgrade} <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">{c.recommended}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.recommendations.map((rec) => {
              const Icon = CATEGORY_ICONS[rec.category] || Sparkles;
              return (
                <div key={rec.category} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold">{rec.name}</h3>
                      <p className="text-xs text-muted-foreground">{c.startingFrom} {formatPrice(rec.startingPrice, lang)}{c.perMonthShort}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{rec.reason}</p>
                  <button
                    onClick={() => toast.info(c.moreInfoToast)}
                    className="w-full py-2 bg-card-hover border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition flex items-center justify-center gap-2"
                  >
                    {c.moreInfo} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
