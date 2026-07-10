"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";

// Data-contract van GET /api/portal/brain. Bewust geen interne velden
// (geen scores, geen source-ids, geen signalen of acties). Toon alleen
// wat binnenkomt.

export type BrainNodeType = "campagne" | "creatie" | "outcome" | "kennis";

export interface BrainNode {
  id: string;
  label: string;
  type: BrainNodeType;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  tags: string[];
  why: string;
  delta: string | null;
  lineage_node_id: string | null;
}

// Een edge is een tuple van twee node-ids.
export type BrainEdge = [string, string];

export type HealthStatus = "fresh" | "stale" | "missing";

export interface BrainHealth {
  source: string;
  status: HealthStatus;
  last_sync: string | null;
}

export type DensityGate = "none" | "preview" | "full";

export interface BrainDensity {
  nodes: number;
  edges: number;
  gate: DensityGate;
}

export interface BrainData {
  nodes: BrainNode[];
  edges: BrainEdge[];
  health: BrainHealth[];
  density: BrainDensity;
}

const EMPTY_BRAIN: BrainData = {
  nodes: [],
  edges: [],
  health: [],
  density: { nodes: 0, edges: 0, gate: "none" },
};

// Normaliseert een binnenkomend type naar de bekende set. Onbekende
// waarden vallen terug op "kennis" zodat de graaf nooit crasht op een
// onverwachte string uit de API.
export function normalizeType(value: string): BrainNodeType {
  if (value === "campagne" || value === "creatie" || value === "outcome" || value === "kennis") {
    return value;
  }
  return "kennis";
}

// Verdedigende parser: onbekende of half-gevulde payloads worden stil
// gladgetrokken naar een lege, veilige graaf in plaats van te crashen.
function coerceBrainData(raw: unknown): BrainData {
  if (!raw || typeof raw !== "object") return EMPTY_BRAIN;
  const obj = raw as Partial<BrainData>;

  const nodes: BrainNode[] = Array.isArray(obj.nodes)
    ? obj.nodes
        .filter((n): n is BrainNode => !!n && typeof n === "object" && typeof (n as BrainNode).id === "string")
        .map((n) => ({
          id: String(n.id),
          label: typeof n.label === "string" ? n.label : "",
          type: normalizeType(String(n.type)),
          period_start: typeof n.period_start === "string" ? n.period_start : null,
          period_end: typeof n.period_end === "string" ? n.period_end : null,
          period_label: typeof n.period_label === "string" ? n.period_label : null,
          tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === "string") : [],
          why: typeof n.why === "string" ? n.why : "",
          delta: typeof n.delta === "string" ? n.delta : null,
          lineage_node_id: typeof n.lineage_node_id === "string" ? n.lineage_node_id : null,
        }))
    : [];

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: BrainEdge[] = Array.isArray(obj.edges)
    ? obj.edges
        .filter(
          (e): e is BrainEdge =>
            Array.isArray(e) && e.length === 2 && typeof e[0] === "string" && typeof e[1] === "string",
        )
        // Alleen edges tussen bestaande nodes tonen.
        .filter((e) => nodeIds.has(e[0]) && nodeIds.has(e[1]))
    : [];

  const health: BrainHealth[] = Array.isArray(obj.health)
    ? obj.health
        .filter((h): h is BrainHealth => !!h && typeof h === "object" && typeof (h as BrainHealth).source === "string")
        .map((h) => ({
          source: String(h.source),
          status: h.status === "fresh" || h.status === "stale" || h.status === "missing" ? h.status : "missing",
          last_sync: typeof h.last_sync === "string" ? h.last_sync : null,
        }))
    : [];

  const rawDensity = obj.density && typeof obj.density === "object" ? obj.density : null;
  const gate = rawDensity?.gate;
  const density: BrainDensity = {
    nodes: typeof rawDensity?.nodes === "number" ? rawDensity.nodes : nodes.length,
    edges: typeof rawDensity?.edges === "number" ? rawDensity.edges : edges.length,
    gate: gate === "none" || gate === "preview" || gate === "full" ? gate : nodes.length > 0 ? "full" : "none",
  };

  return { nodes, edges, health, density };
}

export interface UseBrainDataResult {
  data: BrainData | null;
  loading: boolean;
  error: string | null;
}

// Typed fetcher met nette fallback: bij een fout krijg je een lege graaf
// (geen crash) plus een leesbare foutmelding voor de UI.
export function useBrainData(): UseBrainDataResult {
  const [data, setData] = useState<BrainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Beginstaat is al loading=true / error=null; effect draait eenmalig
    // (lege deps), dus geen synchrone setState nodig aan het begin.
    portalFetch<unknown>("/brain")
      .then((raw) => {
        if (!active) return;
        setData(coerceBrainData(raw));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Kon het geheugen niet laden.");
        setData(EMPTY_BRAIN);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}
