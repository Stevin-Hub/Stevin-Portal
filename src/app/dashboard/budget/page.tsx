"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { Check, X, ExternalLink, Wallet, Clock } from "lucide-react";

interface BudgetProposal {
  id: string;
  title: string;
  description: string | null;
  current_budget: number | null;
  proposed_budget: number;
  currency: string;
  platform: string | null;
  status: "pending" | "approved" | "rejected" | "paid";
  stripe_link: string | null;
  decided_at: string | null;
  created_at: string;
}

function formatCurrency(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function BudgetPage() {
  return (
    <AuthGuard>
      {(user) => <BudgetContent userRole={user.role} />}
    </AuthGuard>
  );
}

function BudgetContent({ userRole }: { userRole: string }) {
  const canDecide = userRole === "admin" || userRole === "medewerker";
  const [proposals, setProposals] = useState<BudgetProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    try {
      const data = await portalFetch<{ proposals: BudgetProposal[] }>("/budget");
      setProposals(data.proposals);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(id: string, decision: string) {
    setDecidingId(id);
    try {
      const result = await portalFetch<{ success: boolean; stripeLink?: string }>(`/budget/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });

      if (decision === "approved" && result.stripeLink) {
        toast.success("Goedgekeurd! Je wordt doorgestuurd naar de betaling.");
        window.open(result.stripeLink, "_blank");
      } else if (decision === "approved") {
        toast.success("Budget goedgekeurd!");
      } else {
        toast.info("Budget afgekeurd");
      }

      await loadProposals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDecidingId(null);
    }
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "Wacht op beoordeling", color: "text-warning", bg: "bg-warning-light" },
    approved: { label: "Goedgekeurd", color: "text-success", bg: "bg-success-light" },
    rejected: { label: "Afgekeurd", color: "text-danger", bg: "bg-danger-light" },
    paid: { label: "Betaald", color: "text-success", bg: "bg-success-light" },
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Budget</h1>
        <p className="text-muted-foreground text-sm mt-1">Beheer budgetvoorstellen voor je campagnes</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Wallet className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted-foreground">Geen budgetvoorstellen</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => {
            const sc = statusConfig[p.status];
            const increase = p.current_budget ? p.proposed_budget - p.current_budget : null;

            return (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{p.title}</h3>
                      {p.platform && (
                        <span className="text-xs text-muted-foreground bg-card-hover px-2 py-0.5 rounded mt-1 inline-block">
                          {p.platform}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.color} ${sc.bg}`}>
                      {sc.label}
                    </span>
                  </div>

                  {p.description && (
                    <p className="text-sm text-muted-foreground mb-4">{p.description}</p>
                  )}

                  {/* Budget comparison */}
                  <div className="flex items-center gap-4 p-4 bg-card-hover rounded-lg mb-4">
                    {p.current_budget !== null && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Huidig budget</p>
                          <p className="text-lg font-semibold">{formatCurrency(p.current_budget, p.currency)}</p>
                        </div>
                        <div className="text-muted">→</div>
                      </>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {p.current_budget !== null ? "Voorgesteld budget" : "Budget"}
                      </p>
                      <p className="text-lg font-bold text-accent">{formatCurrency(p.proposed_budget, p.currency)}</p>
                    </div>
                    {increase !== null && increase > 0 && (
                      <div className="ml-auto">
                        <span className="text-sm font-medium text-success bg-success-light px-2 py-1 rounded">
                          +{formatCurrency(increase, p.currency)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions — only for medewerker/admin */}
                  {p.status === "pending" && !canDecide && (
                    <div className="bg-card-hover border border-border-subtle rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">Alleen medewerkers en admins kunnen budgetvoorstellen beoordelen.</p>
                    </div>
                  )}
                  {p.status === "pending" && canDecide && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecision(p.id, "approved")}
                        disabled={decidingId === p.id}
                        className="flex items-center gap-2 px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 transition disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Goedkeuren{p.stripe_link ? " & Betalen" : ""}
                      </button>
                      <button
                        onClick={() => handleDecision(p.id, "rejected")}
                        disabled={decidingId === p.id}
                        className="flex items-center gap-2 px-4 py-2 bg-card-hover border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Afkeuren
                      </button>
                    </div>
                  )}

                  {p.status === "approved" && p.stripe_link && (
                    <a
                      href={p.stripe_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ga naar betaling
                    </a>
                  )}
                </div>

                <div className="px-5 py-2.5 bg-card-hover border-t border-border-subtle flex items-center gap-2 text-xs text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(p.created_at).toLocaleDateString("nl-NL", {
                    day: "numeric", month: "long", year: "numeric"
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
