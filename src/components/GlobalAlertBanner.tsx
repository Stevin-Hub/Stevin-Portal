"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";

interface GlobalAlert {
  id: string;
  title: string;
  description: string | null;
  platform: string | null;
  severity: string;
  created_at: string;
}

/**
 * Actieve platform-storingen (global alerts) van de Hub.
 *
 * Hier stond ook een banner-component, maar dat werd nergens gerenderd; alleen
 * deze hook wordt gebruikt (contact/page.tsx, voor de Calendly-deflectie). Het
 * dode component is weg, de hook blijft.
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
