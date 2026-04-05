"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { Pause, Play, TrendingDown, TrendingUp, Clock, CheckCircle, XCircle, ShieldAlert, AlertTriangle } from "lucide-react";

interface ActionRequest {
  id: string;
  campaign_name: string | null;
  platform: string | null;
  action_type: string;
  current_value: number | null;
  requested_value: number | null;
  status: string;
  risk_explanation: string | null;
  is_weekend: boolean;
  created_at: string;
  executed_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending_explanation: { label: "Risico-informatie", color: "text-warning", bg: "bg-warning-light", icon: AlertTriangle },
  pending_confirmation: { label: "Wacht op bevestiging", color: "text-warning", bg: "bg-warning-light", icon: Clock },
  pending_execution: { label: "In behandeling", color: "text-accent", bg: "bg-accent/10", icon: Clock },
  executed: { label: "Uitgevoerd", color: "text-success", bg: "bg-success-light", icon: CheckCircle },
  rejected: { label: "Geannuleerd", color: "text-muted", bg: "bg-card-hover", icon: XCircle },
  blocked: { label: "Geblokkeerd", color: "text-danger", bg: "bg-danger-light", icon: ShieldAlert },
};

const ACTION_LABELS: Record<string, string> = {
  pause: "Campagne pauzeren",
  resume: "Campagne hervatten",
  budget_decrease: "Budget verlagen",
  budget_increase: "Budget verhogen",
};

export default function CampaignsPage() {
  return (
    <AuthGuard>
      {(user) => <CampaignsContent userRole={user.role} />}
    </AuthGuard>
  );
}

function CampaignsContent({ userRole }: { userRole: string }) {
  const isOwner = userRole === "admin";
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [actionType, setActionType] = useState<string>("pause");
  const [campaignName, setCampaignName] = useState("");
  const [platform, setPlatform] = useState("meta");
  const [currentBudget, setCurrentBudget] = useState("");
  const [newBudget, setNewBudget] = useState("");

  // Pending confirmation
  const [pendingRequest, setPendingRequest] = useState<{ id: string; riskExplanation: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { loadRequests(); }, []);

  async function loadRequests() {
    try {
      const data = await portalFetch<{ requests: ActionRequest[] }>("/campaign-actions");
      setRequests(data.requests);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || submitting) return;
    setSubmitting(true);

    try {
      const body: Record<string, any> = { actionType, campaignName, platform };
      if (actionType === "budget_decrease" || actionType === "budget_increase") {
        body.currentValue = Number(currentBudget);
        body.requestedValue = Number(newBudget);
      }

      const result = await portalFetch<{
        id: string;
        status: string;
        riskExplanation?: string;
        blocked?: boolean;
        blockedReason?: string;
      }>("/campaign-actions/request", { method: "POST", body: JSON.stringify(body) });

      if (result.blocked) {
        toast.error(result.blockedReason || "Verzoek geblokkeerd");
        setShowForm(false);
        await loadRequests();
      } else if (result.riskExplanation) {
        setPendingRequest({ id: result.id, riskExplanation: result.riskExplanation });
        setShowForm(false);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!pendingRequest || confirming) return;
    setConfirming(true);

    try {
      const result = await portalFetch<{ success: boolean; message: string }>(
        `/campaign-actions/${pendingRequest.id}/confirm`,
        { method: "POST" },
      );
      toast.success(result.message);
      setPendingRequest(null);
      await loadRequests();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Campagnes</h1>
          <p className="text-muted-foreground text-sm mt-1">Beheer je campagne-instellingen en verzoeken</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition"
          >
            Nieuw verzoek
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="bg-card-hover border border-border-subtle rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            Alleen de eigenaar (admin) kan campagnewijzigingen aanvragen. Neem contact op met de accountbeheerder.
          </p>
        </div>
      )}

      {/* Risk explanation dialog (double opt-in step 2) */}
      {pendingRequest && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-warning-light flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <h3 className="font-bold text-lg">Belangrijk</h3>
            </div>
            <div className="bg-card-hover border border-border-subtle rounded-xl p-4 text-sm space-y-2 mb-5">
              {pendingRequest.riskExplanation.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingRequest(null)}
                className="flex-1 py-2.5 bg-card-hover border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition"
              >
                Annuleren
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50"
              >
                {confirming ? "Bezig..." : "Bevestigen & Doorzetten"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Je verzoek wordt handmatig uitgevoerd door je specialist
            </p>
          </div>
        </div>
      )}

      {/* New request form */}
      {showForm && isOwner && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold mb-4">Campagnewijziging aanvragen</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Type wijziging</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-2 bg-card-hover border border-border rounded-lg text-sm"
                >
                  <option value="pause">Campagne pauzeren</option>
                  <option value="resume">Campagne hervatten</option>
                  <option value="budget_decrease">Budget verlagen</option>
                  <option value="budget_increase">Budget verhogen</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 bg-card-hover border border-border rounded-lg text-sm"
                >
                  <option value="meta">Meta (Facebook/Instagram)</option>
                  <option value="google">Google Ads</option>
                  <option value="dv360">DV360</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Campagnenaam</label>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Bijv. 'Brand Awareness - NL'"
                required
                className="w-full px-3 py-2 bg-card-hover border border-border rounded-lg text-sm placeholder:text-muted"
              />
            </div>
            {(actionType === "budget_decrease" || actionType === "budget_increase") && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Huidig budget (EUR)</label>
                  <input
                    type="number"
                    value={currentBudget}
                    onChange={(e) => setCurrentBudget(e.target.value)}
                    placeholder="500"
                    required
                    className="w-full px-3 py-2 bg-card-hover border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Gewenst budget (EUR)</label>
                  <input
                    type="number"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value)}
                    placeholder="300"
                    required
                    className="w-full px-3 py-2 bg-card-hover border border-border rounded-lg text-sm"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-card-hover border border-border text-sm rounded-lg"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50"
              >
                {submitting ? "Bezig..." : "Verzoek indienen"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request history */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Clock className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted-foreground">Geen campagneverzoeken</p>
          <p className="text-xs text-muted mt-1">
            Hier verschijnen je verzoeken voor campagnewijzigingen
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending_execution;
            const StatusIcon = sc.icon;
            const isBudget = r.action_type === "budget_decrease" || r.action_type === "budget_increase";

            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sc.bg}`}>
                      <StatusIcon className={`w-4 h-4 ${sc.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{ACTION_LABELS[r.action_type] || r.action_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.campaign_name || "Onbekend"} — {r.platform || "onbekend"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.color} ${sc.bg}`}>
                      {sc.label}
                    </span>
                    {r.is_weekend && (
                      <p className="text-xs text-danger mt-1">Weekend-escalatie</p>
                    )}
                  </div>
                </div>
                {isBudget && r.current_value != null && r.requested_value != null && (
                  <div className="flex items-center gap-2 mt-2 text-sm">
                    <span className="text-muted-foreground">EUR {r.current_value}</span>
                    <span className="text-muted">→</span>
                    <span className="font-medium">EUR {r.requested_value}</span>
                  </div>
                )}
                <p className="text-xs text-muted mt-2">
                  {new Date(r.created_at).toLocaleDateString("nl-NL", {
                    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
