"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { Calendar, Mail, User, ExternalLink, Radio } from "lucide-react";
import { useGlobalAlerts } from "@/components/GlobalAlertBanner";

interface AccountData {
  client: {
    consultant_name: string | null;
    consultant_email: string | null;
    consultant_calendly: string | null;
  } | null;
}

export default function ContactPage() {
  return (
    <AuthGuard>
      {() => <ContactContent />}
    </AuthGuard>
  );
}

function ContactContent() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const globalAlerts = useGlobalAlerts();
  const hasGlobalIssue = globalAlerts.length > 0;

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

  const consultant = data?.client;
  const hasConsultant = consultant?.consultant_name || consultant?.consultant_email;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Contact</h1>
        <p className="text-muted-foreground text-sm mt-1">Neem contact op met je consultant</p>
      </div>

      {!hasConsultant ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <User className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted-foreground">
            Er is nog geen consultant gekoppeld aan je account. Neem contact op via{" "}
            <a href="mailto:info@stevin.ai" className="text-accent hover:underline">info@stevin.ai</a>.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Consultant card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <User className="w-7 h-7 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{consultant?.consultant_name}</h3>
                <p className="text-sm text-muted-foreground">Je dedicated consultant bij Stevin.AI</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {consultant?.consultant_email && (
                <a
                  href={`mailto:${consultant.consultant_email}`}
                  className="flex items-center gap-3 p-4 bg-card-hover border border-border-subtle rounded-xl hover:border-accent/30 transition group"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition">
                    <Mail className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">E-mail</p>
                    <p className="text-xs text-muted-foreground">{consultant.consultant_email}</p>
                  </div>
                </a>
              )}

              {consultant?.consultant_calendly && (
                hasGlobalIssue ? (
                  <div className="flex items-center gap-3 p-4 bg-warning-light border border-warning/20 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                      <Radio className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Updates volgen</p>
                      <p className="text-xs text-muted-foreground">
                        Er is momenteel een platformstoring. We houden je op de hoogte via het portaal.
                      </p>
                    </div>
                  </div>
                ) : (
                  <a
                    href={consultant.consultant_calendly}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-card-hover border border-border-subtle rounded-xl hover:border-accent/30 transition group"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition">
                      <Calendar className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Afspraak inplannen</p>
                      <p className="text-xs text-muted-foreground">Boek een tijdslot in de agenda</p>
                    </div>
                  </a>
                )
              )}
            </div>
          </div>

          {/* Calendly embed */}
          {consultant?.consultant_calendly && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold text-sm">Plan een gesprek</h3>
                </div>
                <a
                  href={consultant.consultant_calendly}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1"
                >
                  Open in nieuw tabblad <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <iframe
                src={consultant.consultant_calendly}
                className="w-full border-0"
                style={{ height: "660px" }}
                title="Plan een afspraak"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
