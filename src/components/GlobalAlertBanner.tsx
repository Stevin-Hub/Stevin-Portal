"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { AlertTriangle, Radio } from "lucide-react";

interface GlobalAlert {
  id: string;
  title: string;
  description: string | null;
  platform: string | null;
  severity: string;
  created_at: string;
}

/**
 * Shows a banner when there's an active global alert (platform outage etc.).
 * Also exports the alert state so parent can use it for Calendly deflection.
 */
export function useGlobalAlerts() {
  const [alerts, setAlerts] = useState<GlobalAlert[]>([]);

  useEffect(() => {
    portalFetch<{ alerts: GlobalAlert[] }>("/global-alerts")
      .then((data) => setAlerts(data.alerts))
      .catch(() => {});
  }, []);

  return alerts;
}

export default function GlobalAlertBanner({ alerts }: { alerts: GlobalAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (alerts.length === 0) return null;

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-xl p-4 flex items-start gap-3 ${
            alert.severity === "critical"
              ? "bg-danger-light border border-danger/20"
              : "bg-warning-light border border-warning/20"
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              alert.severity === "critical" ? "text-danger" : "text-warning"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {alert.platform && (
                <span className="text-xs font-medium bg-black/5 px-1.5 py-0.5 rounded capitalize">
                  {alert.platform}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(alert.created_at).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm font-medium">{alert.title}</p>
            {alert.description && (
              <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
            )}
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, alert.id]))}
            className="text-xs text-muted hover:text-foreground transition flex-shrink-0"
          >
            Sluiten
          </button>
        </div>
      ))}
      {visible.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Radio className="w-3 h-3" />
          <span>We houden de situatie in de gaten. Neem bij vragen contact op met je specialist.</span>
        </div>
      )}
    </div>
  );
}
