"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { useLanguage, localeFor, type Lang } from "@/lib/useLanguage";
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

// Alleen kleur en icoon; de labels komen uit COPY zodat ze meetalen.
const STATUS_STYLE: Record<string, { color: string; bg: string; icon: any }> = {
  pending_explanation: { color: "text-warning", bg: "bg-warning-light", icon: AlertTriangle },
  pending_confirmation: { color: "text-warning", bg: "bg-warning-light", icon: Clock },
  pending_execution: { color: "text-accent", bg: "bg-accent/10", icon: Clock },
  executed: { color: "text-success", bg: "bg-success-light", icon: CheckCircle },
  rejected: { color: "text-muted", bg: "bg-card-hover", icon: XCircle },
  blocked: { color: "text-danger", bg: "bg-danger-light", icon: ShieldAlert },
};

interface Copy {
  title: string;
  subtitle: string;
  newRequest: string;
  ownerOnly: string;
  statusLabels: Record<string, string>;
  actionLabels: Record<string, string>;
  riskTitle: string;
  cancel: string;
  busy: string;
  confirmAndSend: string;
  manualNote: string;
  formTitle: string;
  changeTypeLabel: string;
  platformLabel: string;
  campaignNameLabel: string;
  campaignNamePlaceholder: string;
  currentBudgetLabel: string;
  desiredBudgetLabel: string;
  submit: string;
  emptyTitle: string;
  emptyHint: string;
  unknownCampaign: string;
  unknownPlatform: string;
  weekendEscalation: string;
  blockedFallback: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    title: "Campagnes",
    subtitle: "Beheer je campagne-instellingen en verzoeken",
    newRequest: "Nieuw verzoek",
    ownerOnly: "Alleen de eigenaar (admin) kan campagnewijzigingen aanvragen. Neem contact op met de accountbeheerder.",
    statusLabels: {
      pending_explanation: "Risico-informatie",
      pending_confirmation: "Wacht op bevestiging",
      pending_execution: "In behandeling",
      executed: "Uitgevoerd",
      rejected: "Geannuleerd",
      blocked: "Geblokkeerd",
    },
    actionLabels: {
      pause: "Campagne pauzeren",
      resume: "Campagne hervatten",
      budget_decrease: "Budget verlagen",
      budget_increase: "Budget verhogen",
    },
    riskTitle: "Belangrijk",
    cancel: "Annuleren",
    busy: "Bezig...",
    confirmAndSend: "Bevestigen & Doorzetten",
    manualNote: "Je verzoek wordt handmatig uitgevoerd door je specialist",
    formTitle: "Campagnewijziging aanvragen",
    changeTypeLabel: "Type wijziging",
    platformLabel: "Platform",
    campaignNameLabel: "Campagnenaam",
    campaignNamePlaceholder: "Bijv. 'Brand Awareness - NL'",
    currentBudgetLabel: "Huidig budget (EUR)",
    desiredBudgetLabel: "Gewenst budget (EUR)",
    submit: "Verzoek indienen",
    emptyTitle: "Geen campagneverzoeken",
    emptyHint: "Hier verschijnen je verzoeken voor campagnewijzigingen",
    unknownCampaign: "Onbekend",
    unknownPlatform: "onbekend",
    weekendEscalation: "Weekend-escalatie",
    blockedFallback: "Verzoek geblokkeerd",
  },
  en: {
    title: "Campaigns",
    subtitle: "Manage your campaign settings and requests",
    newRequest: "New request",
    ownerOnly: "Only the owner (admin) can request campaign changes. Please contact the account administrator.",
    statusLabels: {
      pending_explanation: "Risk information",
      pending_confirmation: "Waiting for confirmation",
      pending_execution: "In progress",
      executed: "Carried out",
      rejected: "Cancelled",
      blocked: "Blocked",
    },
    actionLabels: {
      pause: "Pause campaign",
      resume: "Resume campaign",
      budget_decrease: "Lower budget",
      budget_increase: "Raise budget",
    },
    riskTitle: "Important",
    cancel: "Cancel",
    busy: "Working...",
    confirmAndSend: "Confirm & send through",
    manualNote: "Your request is carried out by your specialist",
    formTitle: "Request a campaign change",
    changeTypeLabel: "Type of change",
    platformLabel: "Platform",
    campaignNameLabel: "Campaign name",
    campaignNamePlaceholder: "For example 'Brand Awareness - NL'",
    currentBudgetLabel: "Current budget (EUR)",
    desiredBudgetLabel: "Requested budget (EUR)",
    submit: "Submit request",
    emptyTitle: "No campaign requests",
    emptyHint: "Your requests for campaign changes appear here",
    unknownCampaign: "Unknown",
    unknownPlatform: "unknown",
    weekendEscalation: "Weekend escalation",
    blockedFallback: "Request blocked",
  },
};

export default function CampaignsPage() {
  return (
    <AuthGuard>
      {(user) => <CampaignsContent userRole={user.role} />}
    </AuthGuard>
  );
}

function CampaignsContent({ userRole }: { userRole: string }) {
  const lang = useLanguage();
  const c = COPY[lang];
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
        toast.error(result.blockedReason || c.blockedFallback);
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
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{c.subtitle}</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition"
          >
            {c.newRequest}
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="bg-card-hover border border-border-subtle rounded-xl p-4 mb-6">
          <p className="text-sm text-muted-foreground">
            {c.ownerOnly}
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
              <h3 className="font-bold text-lg">{c.riskTitle}</h3>
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
                {c.cancel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50"
              >
                {confirming ? c.busy : c.confirmAndSend}
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-3">
              {c.manualNote}
            </p>
          </div>
        </div>
      )}

      {/* New request form */}
      {showForm && isOwner && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="font-semibold mb-4">{c.formTitle}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{c.changeTypeLabel}</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-2 bg-card-hover border border-border rounded-lg text-sm"
                >
                  <option value="pause">{c.actionLabels.pause}</option>
                  <option value="resume">{c.actionLabels.resume}</option>
                  <option value="budget_decrease">{c.actionLabels.budget_decrease}</option>
                  <option value="budget_increase">{c.actionLabels.budget_increase}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{c.platformLabel}</label>
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
              <label className="block text-xs text-muted-foreground mb-1">{c.campaignNameLabel}</label>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder={c.campaignNamePlaceholder}
                required
                className="w-full px-3 py-2 bg-card-hover border border-border rounded-lg text-sm placeholder:text-muted"
              />
            </div>
            {(actionType === "budget_decrease" || actionType === "budget_increase") && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{c.currentBudgetLabel}</label>
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
                  <label className="block text-xs text-muted-foreground mb-1">{c.desiredBudgetLabel}</label>
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
                {c.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50"
              >
                {submitting ? c.busy : c.submit}
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
          <p className="text-muted-foreground">{c.emptyTitle}</p>
          <p className="text-xs text-muted mt-1">
            {c.emptyHint}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const sc = STATUS_STYLE[r.status] || STATUS_STYLE.pending_execution;
            const statusLabel = c.statusLabels[r.status] || c.statusLabels.pending_execution;
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
                      <p className="font-medium text-sm">{c.actionLabels[r.action_type] || r.action_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.campaign_name || c.unknownCampaign}, {r.platform || c.unknownPlatform}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sc.color} ${sc.bg}`}>
                      {statusLabel}
                    </span>
                    {r.is_weekend && (
                      <p className="text-xs text-danger mt-1">{c.weekendEscalation}</p>
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
                  {new Date(r.created_at).toLocaleDateString(localeFor(lang), {
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
