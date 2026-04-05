"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
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

export default function ApprovalsPage() {
  return (
    <AuthGuard>
      {(user) => <ApprovalsContent userRole={user.role} />}
    </AuthGuard>
  );
}

function ApprovalsContent({ userRole }: { userRole: string }) {
  const canDecide = userRole === "admin" || userRole === "medewerker";
  const [approvals, setApprovals] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
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
        decision === "approved" ? "Goedgekeurd!" :
        decision === "rejected" ? "Afgekeurd" : "Revisie aangevraagd"
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

  const filtered = filter === "all" ? approvals : approvals.filter((a) => a.status === filter);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "Wacht op beoordeling", color: "text-warning", bg: "bg-warning-light" },
    approved: { label: "Goedgekeurd", color: "text-success", bg: "bg-success-light" },
    rejected: { label: "Afgekeurd", color: "text-danger", bg: "bg-danger-light" },
    revision_requested: { label: "Revisie gevraagd", color: "text-accent", bg: "bg-accent-light" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Goedkeuringen</h1>
          <p className="text-muted-foreground text-sm mt-1">Beoordeel creatives voor je campagnes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: "all", label: "Alles" },
          { key: "pending", label: "Open" },
          { key: "approved", label: "Goedgekeurd" },
          { key: "rejected", label: "Afgekeurd" },
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
          <p className="text-muted-foreground">Geen goedkeuringen gevonden</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((approval) => {
            const sc = statusConfig[approval.status];
            return (
              <div
                key={approval.id}
                className="bg-card border border-border rounded-xl overflow-hidden"
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
                      <p className="text-sm font-medium mb-1">Jouw feedback:</p>
                      <p className="text-sm text-muted-foreground">{approval.feedback_text}</p>
                    </div>
                  )}

                  {/* Action buttons for pending — only for medewerker/admin */}
                  {approval.status === "pending" && !canDecide && (
                    <div className="bg-card-hover border border-border-subtle rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">Alleen medewerkers en admins kunnen goedkeuringen beoordelen.</p>
                    </div>
                  )}
                  {approval.status === "pending" && canDecide && (
                    <div>
                      {feedbackFor === approval.id ? (
                        <div className="space-y-3">
                          <label htmlFor={`feedback-${approval.id}`} className="block text-sm font-medium mb-1.5">
                            Feedback <span className="text-danger">*</span>
                          </label>
                          <textarea
                            id={`feedback-${approval.id}`}
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Vertel ons wat je anders wilt zien..."
                            maxLength={1000}
                            required
                            className={`w-full px-3 py-2 bg-background border rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-accent/50 transition ${
                              feedbackText.trim() ? "border-border" : "border-warning/50"
                            }`}
                          />
                          <p className="text-xs text-muted mt-1">{feedbackText.length}/1000 tekens</p>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleDecision(approval.id, "rejected", feedbackText)}
                              disabled={decidingId === approval.id || !feedbackText.trim()}
                              className="px-4 py-2 bg-danger text-white text-sm font-medium rounded-lg hover:bg-danger/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Afkeuren
                            </button>
                            <button
                              onClick={() => handleDecision(approval.id, "revision_requested", feedbackText)}
                              disabled={decidingId === approval.id || !feedbackText.trim()}
                              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Revisie vragen
                            </button>
                            <button
                              onClick={() => { setFeedbackFor(null); setFeedbackText(""); }}
                              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                            >
                              Annuleren
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
                            Goedkeuren
                          </button>
                          <button
                            onClick={() => setFeedbackFor(approval.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-card-hover border border-border text-sm font-medium rounded-lg hover:bg-card-hover transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Feedback geven
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-5 py-2.5 bg-card-hover border-t border-border-subtle flex items-center gap-2 text-xs text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(approval.created_at).toLocaleDateString("nl-NL", {
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
