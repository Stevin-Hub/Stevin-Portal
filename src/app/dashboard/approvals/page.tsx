"use client";

/**
 * Goedkeuringen. De Hub stuurt een one-click-link door naar
 * /dashboard/approvals?id=<creative-id>. Dat id zetten we bovenaan de lijst,
 * los van het gekozen filter, zodat de klant meteen ziet waarvoor hij kwam.
 * Onbekend id betekent gewoon de normale lijst, geen foutmelding: de link kan
 * oud zijn en dan is er niets aan de hand.
 *
 * Het id komt uit window.location.search en niet uit useSearchParams, zodat
 * deze pagina geen Suspense-grens nodig heeft. De link is altijd een verse
 * paginalading vanuit de mail, dus een effect bij het mounten is genoeg.
 */

import { useEffect, useMemo, useState } from "react";
import { portalFetch } from "@/lib/api";
import { useLanguage, localeFor, type Lang } from "@/lib/useLanguage";
import AuthGuard from "@/components/AuthGuard";
import { toast } from "sonner";
import { Check, X, RotateCcw, Clock, Image as ImageIcon } from "lucide-react";

interface Creative {
  id: string;
  title: string;
  description: string | null;
  image_urls: string[];
  platform: string | null;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  feedback_text: string | null;
  decided_at: string | null;
  created_at: string;
}

interface Copy {
  title: string;
  subtitle: string;
  filterAll: string;
  filterPending: string;
  filterApproved: string;
  filterRejected: string;
  statusPending: string;
  statusApproved: string;
  statusRejected: string;
  statusRevision: string;
  empty: string;
  yourFeedback: string;
  noPermission: string;
  feedbackLabel: string;
  feedbackPlaceholder: string;
  charCount: (used: number, max: number) => string;
  reject: string;
  requestRevision: string;
  cancel: string;
  approve: string;
  giveFeedback: string;
  toastApproved: string;
  toastRejected: string;
  toastRevision: string;
}

const COPY: Record<Lang, Copy> = {
  nl: {
    title: "Goedkeuringen",
    subtitle: "Beoordeel creatives voor je campagnes",
    filterAll: "Alles",
    filterPending: "Open",
    filterApproved: "Goedgekeurd",
    filterRejected: "Afgekeurd",
    statusPending: "Wacht op beoordeling",
    statusApproved: "Goedgekeurd",
    statusRejected: "Afgekeurd",
    statusRevision: "Revisie gevraagd",
    empty: "Geen goedkeuringen gevonden",
    yourFeedback: "Jouw feedback:",
    noPermission: "Alleen medewerkers en admins kunnen goedkeuringen beoordelen.",
    feedbackLabel: "Feedback",
    feedbackPlaceholder: "Vertel ons wat je anders wilt zien...",
    charCount: (used, max) => `${used}/${max} tekens`,
    reject: "Afkeuren",
    requestRevision: "Revisie vragen",
    cancel: "Annuleren",
    approve: "Goedkeuren",
    giveFeedback: "Feedback geven",
    toastApproved: "Goedgekeurd!",
    toastRejected: "Afgekeurd",
    toastRevision: "Revisie aangevraagd",
  },
  en: {
    title: "Approvals",
    subtitle: "Review the creatives for your campaigns",
    filterAll: "All",
    filterPending: "Open",
    filterApproved: "Approved",
    filterRejected: "Rejected",
    statusPending: "Waiting for review",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusRevision: "Revision requested",
    empty: "No approvals found",
    yourFeedback: "Your feedback:",
    noPermission: "Only staff and admins can review approvals.",
    feedbackLabel: "Feedback",
    feedbackPlaceholder: "Tell us what you would like to see differently...",
    charCount: (used, max) => `${used}/${max} characters`,
    reject: "Reject",
    requestRevision: "Request revision",
    cancel: "Cancel",
    approve: "Approve",
    giveFeedback: "Give feedback",
    toastApproved: "Approved!",
    toastRejected: "Rejected",
    toastRevision: "Revision requested",
  },
};

export default function ApprovalsPage() {
  return (
    <AuthGuard>
      {(user) => <ApprovalsContent userRole={user.role} />}
    </AuthGuard>
  );
}

function ApprovalsContent({ userRole }: { userRole: string }) {
  const lang = useLanguage();
  const c = COPY[lang];
  const canDecide = userRole === "admin" || userRole === "medewerker";
  const [approvals, setApprovals] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setFocusId(id);
  }, []);

  async function loadApprovals() {
    try {
      const data = await portalFetch<{ approvals: Creative[] }>("/approvals");
      setApprovals(data.approvals);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(id: string, decision: string, feedback?: string) {
    setDecidingId(id);
    try {
      await portalFetch(`/approvals/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, feedback }),
      });
      toast.success(
        decision === "approved" ? c.toastApproved :
        decision === "rejected" ? c.toastRejected : c.toastRevision
      );
      setFeedbackFor(null);
      setFeedbackText("");
      await loadApprovals();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDecidingId(null);
    }
  }

  const filtered = useMemo(() => {
    const base = filter === "all" ? approvals : approvals.filter((a) => a.status === filter);
    if (!focusId) return base;
    const pinned = approvals.find((a) => a.id === focusId);
    if (!pinned) return base;
    return [pinned, ...base.filter((a) => a.id !== pinned.id)];
  }, [approvals, filter, focusId]);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: c.statusPending, color: "text-warning", bg: "bg-warning-light" },
    approved: { label: c.statusApproved, color: "text-success", bg: "bg-success-light" },
    rejected: { label: c.statusRejected, color: "text-danger", bg: "bg-danger-light" },
    revision_requested: { label: c.statusRevision, color: "text-accent", bg: "bg-accent-light" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{c.subtitle}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all", label: c.filterAll },
          { key: "pending", label: c.filterPending },
          { key: "approved", label: c.filterApproved },
          { key: "rejected", label: c.filterRejected },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition ${
              filter === key
                ? "bg-accent text-white"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {key === "pending" && approvals.filter((a) => a.status === "pending").length > 0 && (
              <span className="ml-1.5 bg-warning text-white text-xs px-1.5 py-0.5 rounded-full">
                {approvals.filter((a) => a.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <ImageIcon className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="text-muted-foreground">{c.empty}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((approval) => {
            const sc = statusConfig[approval.status];
            const focused = approval.id === focusId;
            return (
              <div
                key={approval.id}
                className={`bg-card border rounded-xl overflow-hidden ${
                  focused ? "border-accent ring-1 ring-accent/40" : "border-border"
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{approval.title}</h3>
                      {approval.platform && (
                        <span className="text-xs text-muted-foreground bg-card-hover px-2 py-0.5 rounded mt-1 inline-block">
                          {approval.platform}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${sc.color} ${sc.bg}`}>
                      {sc.label}
                    </span>
                  </div>

                  {approval.description && (
                    <p className="text-sm text-muted-foreground mb-4">{approval.description}</p>
                  )}

                  {/* Creative previews */}
                  {approval.image_urls.length > 0 && (
                    <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
                      {approval.image_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 w-48 h-48 bg-card-hover border border-border rounded-lg overflow-hidden hover:border-accent transition"
                        >
                          <img src={url} alt={`Creative ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Feedback from client */}
                  {approval.feedback_text && approval.status !== "pending" && (
                    <div className="bg-card-hover border border-border-subtle rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium mb-1">{c.yourFeedback}</p>
                      <p className="text-sm text-muted-foreground">{approval.feedback_text}</p>
                    </div>
                  )}

                  {/* Action buttons for pending, only for medewerker/admin */}
                  {approval.status === "pending" && !canDecide && (
                    <div className="bg-card-hover border border-border-subtle rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">{c.noPermission}</p>
                    </div>
                  )}
                  {approval.status === "pending" && canDecide && (
                    <div>
                      {feedbackFor === approval.id ? (
                        <div className="space-y-3">
                          <label htmlFor={`feedback-${approval.id}`} className="block text-sm font-medium mb-1.5">
                            {c.feedbackLabel} <span className="text-danger">*</span>
                          </label>
                          <textarea
                            id={`feedback-${approval.id}`}
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder={c.feedbackPlaceholder}
                            maxLength={1000}
                            required
                            className={`w-full px-3 py-2 bg-background border rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-accent/50 transition ${
                              feedbackText.trim() ? "border-border" : "border-warning/50"
                            }`}
                          />
                          <p className="text-xs text-muted mt-1">{c.charCount(feedbackText.length, 1000)}</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleDecision(approval.id, "rejected", feedbackText)}
                              disabled={decidingId === approval.id || !feedbackText.trim()}
                              className="px-4 py-2 bg-danger text-white text-sm font-medium rounded-lg hover:bg-danger/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {c.reject}
                            </button>
                            <button
                              onClick={() => handleDecision(approval.id, "revision_requested", feedbackText)}
                              disabled={decidingId === approval.id || !feedbackText.trim()}
                              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {c.requestRevision}
                            </button>
                            <button
                              onClick={() => { setFeedbackFor(null); setFeedbackText(""); }}
                              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                            >
                              {c.cancel}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDecision(approval.id, "approved")}
                            disabled={decidingId === approval.id}
                            className="flex items-center gap-2 px-4 py-2 bg-success text-white text-sm font-medium rounded-lg hover:bg-success/90 transition disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                            {c.approve}
                          </button>
                          <button
                            onClick={() => setFeedbackFor(approval.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-card-hover border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                            {c.giveFeedback}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-5 py-2.5 bg-card-hover border-t border-border-subtle flex items-center gap-2 text-xs text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(approval.created_at).toLocaleDateString(localeFor(lang), {
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
