"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { BrainEdge, BrainNode, BrainNodeType } from "./useBrainData";

const TYPE_COLORS: Record<BrainNodeType, string> = {
  campagne: "#3c8eff",
  creatie: "#14a3a3",
  outcome: "#2f9e6e",
  kennis: "#b7791f",
};

const TYPE_LABELS: Record<BrainNodeType, string> = {
  campagne: "Campagne",
  creatie: "Creatie",
  outcome: "Resultaat",
  kennis: "Kennis",
};

const EDGE_COLOR = "#d6dde8";
const LABEL_COLOR = "#8190a3";
const LABEL_MAX = 24;

// Zachte cluster-ankers per type: een diamant rond het midden zodat
// nodes van hetzelfde type elkaar licht opzoeken zonder harde groepen.
const CLUSTER_DIR: Record<BrainNodeType, { x: number; y: number }> = {
  campagne: { x: 0, y: -1 },
  creatie: { x: 1, y: 0 },
  outcome: { x: 0, y: 1 },
  kennis: { x: -1, y: 0 },
};

interface SimNode {
  node: BrainNode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Transform {
  zoom: number;
  panX: number;
  panY: number;
}

function nodeRadius(type: BrainNodeType): number {
  if (type === "campagne") return 13;
  if (type === "outcome") return 11;
  return 9;
}

function truncate(label: string, max = LABEL_MAX): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1).trimEnd()}…`;
}

// Deterministische pseudo-random op basis van de node-id zodat de
// startlayout stabiel is tussen renders (geen springerige herstart).
function seededOffset(id: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 1000) / 1000;
  const b = ((Math.imul(h, 48271) >>> 0) % 1000) / 1000;
  const angle = a * Math.PI * 2;
  const dist = 40 + b * 160;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
}

interface BrainConstellationProps {
  nodes: BrainNode[];
  edges: BrainEdge[];
}

export default function BrainConstellation({ nodes, edges }: BrainConstellationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const simNodesRef = useRef<SimNode[]>([]);
  const nodeIndexRef = useRef<Map<string, SimNode>>(new Map());
  const transformRef = useRef<Transform>({ zoom: 1, panX: 0, panY: 0 });
  const alphaRef = useRef(1);
  const sizeRef = useRef({ width: 0, height: 0 });
  const rafRef = useRef<number | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [selected, setSelected] = useState<BrainNode | null>(null);

  // Pointer-/interactiestatus in refs zodat het RAF-loop geen re-render
  // triggert. Werkt met muis en touch via pointer events.
  const dragRef = useRef<{
    mode: "none" | "node" | "pan";
    pointerId: number | null;
    simNode: SimNode | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({ mode: "none", pointerId: null, simNode: null, startX: 0, startY: 0, lastX: 0, lastY: 0, moved: false });

  const edgePairs = useMemo(() => edges, [edges]);

  // Bouw de simulatie-nodes op; hergebruik bestaande posities per id zodat
  // een data-refresh de constellatie niet laat opspringen.
  useEffect(() => {
    const prev = nodeIndexRef.current;
    const next = new Map<string, SimNode>();
    const list: SimNode[] = nodes.map((node) => {
      const existing = prev.get(node.id);
      if (existing) {
        existing.node = node;
        existing.radius = nodeRadius(node.type);
        next.set(node.id, existing);
        return existing;
      }
      const off = seededOffset(node.id);
      const created: SimNode = {
        node,
        x: off.x,
        y: off.y,
        vx: 0,
        vy: 0,
        radius: nodeRadius(node.type),
      };
      next.set(node.id, created);
      return created;
    });
    simNodesRef.current = list;
    nodeIndexRef.current = next;
    alphaRef.current = 1; // reheat zodat nieuwe nodes zich kunnen zetten
  }, [nodes]);

  const reheat = useCallback((value = 0.6) => {
    alphaRef.current = Math.max(alphaRef.current, value);
  }, []);

  // Fysica-stap: repulsie tussen nodes, veerkracht op edges, zwak centrum
  // en een zachte cluster-pull per type. Euler-integratie met demping.
  const step = useCallback(() => {
    const sim = simNodesRef.current;
    const n = sim.length;
    if (n === 0) return;

    const alpha = alphaRef.current;
    if (alpha <= 0.02) return; // gestabiliseerd, geen fysica nodig

    const { width, height } = sizeRef.current;
    const REPEL = 5200;
    const SPRING_K = 0.02;
    const REST = 96;
    const CENTER_K = 0.006;
    const CLUSTER_K = 0.018;
    const CLUSTER_DIST = Math.min(width, height) * 0.22;

    // Repulsie (O(n^2); graaf is klein door density-gate).
    for (let i = 0; i < n; i++) {
      const a = sim[i];
      for (let j = i + 1; j < n; j++) {
        const b = sim[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 0.01) {
          dx = (Math.random() - 0.5) * 0.5;
          dy = (Math.random() - 0.5) * 0.5;
          distSq = dx * dx + dy * dy + 0.01;
        }
        const dist = Math.sqrt(distSq);
        const force = (REPEL / distSq) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Veerkracht op edges.
    for (const [sourceId, targetId] of edgePairs) {
      const a = nodeIndexRef.current.get(sourceId);
      const b = nodeIndexRef.current.get(targetId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - REST) * SPRING_K * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Zwak centrum + zachte cluster-pull per type.
    for (let i = 0; i < n; i++) {
      const s = sim[i];
      s.vx += -s.x * CENTER_K * alpha;
      s.vy += -s.y * CENTER_K * alpha;
      const dir = CLUSTER_DIR[s.node.type];
      const targetX = dir.x * CLUSTER_DIST;
      const targetY = dir.y * CLUSTER_DIST;
      s.vx += (targetX - s.x) * CLUSTER_K * alpha;
      s.vy += (targetY - s.y) * CLUSTER_K * alpha;
    }

    // Integratie + demping. De gesleepte node wordt hard gezet elders.
    const drag = dragRef.current;
    for (let i = 0; i < n; i++) {
      const s = sim[i];
      if (drag.mode === "node" && drag.simNode === s) {
        s.vx = 0;
        s.vy = 0;
        continue;
      }
      s.vx *= 0.82;
      s.vy *= 0.82;
      s.x += s.vx;
      s.y += s.vy;
    }

    alphaRef.current = alpha * 0.99;
  }, [edgePairs]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    const { zoom, panX, panY } = transformRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Wereld -> scherm: (0,0) in het midden, plus pan en zoom.
    const ox = width / 2 + panX;
    const oy = height / 2 + panY;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);

    // Edges eerst zodat nodes erbovenop liggen.
    ctx.strokeStyle = EDGE_COLOR;
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    for (const [sourceId, targetId] of edgePairs) {
      const a = nodeIndexRef.current.get(sourceId);
      const b = nodeIndexRef.current.get(targetId);
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    const selectedId = selectedIdRef.current;
    const labelSize = 11 / zoom;

    for (const s of simNodesRef.current) {
      const color = TYPE_COLORS[s.node.type];
      const isSel = selectedId === s.node.id;

      if (isSel) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius + 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(61,142,255,0.16)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = (isSel ? 2 : 1.5) / zoom;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      // Label grijs onder de node, kort.
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = `${labelSize}px "Inter Tight", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(truncate(s.node.label), s.x, s.y + s.radius + 4 / zoom);
    }

    ctx.restore();
  }, [edgePairs]);

  // Enkel RAF-loop: fysica-stap (indien nog niet gestabiliseerd) plus
  // teken. Draait ~60fps, pauzeert wanneer het tabblad verborgen is.
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      step();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      } else if (!running) {
        running = true;
        reheat(0.2);
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [step, draw, reheat]);

  // Canvas-grootte volgen (responsive) met crisp DPR-scaling.
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      sizeRef.current = { width, height };
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      reheat(0.3);
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [reheat]);

  // Scherm- naar wereldcoordinaten voor hit-testing.
  const screenToWorld = useCallback((sx: number, sy: number) => {
    const { width, height } = sizeRef.current;
    const { zoom, panX, panY } = transformRef.current;
    return {
      x: (sx - (width / 2 + panX)) / zoom,
      y: (sy - (height / 2 + panY)) / zoom,
    };
  }, []);

  const nodeAt = useCallback(
    (sx: number, sy: number): SimNode | null => {
      const world = screenToWorld(sx, sy);
      const { zoom } = transformRef.current;
      const slop = 6 / zoom;
      let hit: SimNode | null = null;
      for (const s of simNodesRef.current) {
        const dx = world.x - s.x;
        const dy = world.y - s.y;
        if (dx * dx + dy * dy <= (s.radius + slop) * (s.radius + slop)) {
          hit = s; // laatste (bovenste) node wint
        }
      }
      return hit;
    },
    [screenToWorld],
  );

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = pointerPos(e);
    const hit = nodeAt(x, y);
    const drag = dragRef.current;
    drag.pointerId = e.pointerId;
    drag.startX = x;
    drag.startY = y;
    drag.lastX = x;
    drag.lastY = y;
    drag.moved = false;
    if (hit) {
      drag.mode = "node";
      drag.simNode = hit;
    } else {
      drag.mode = "pan";
      drag.simNode = null;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.mode === "none" || drag.pointerId !== e.pointerId) return;
    const { x, y } = pointerPos(e);
    const dxTotal = x - drag.startX;
    const dyTotal = y - drag.startY;
    if (dxTotal * dxTotal + dyTotal * dyTotal > 16) drag.moved = true;

    if (drag.mode === "node" && drag.simNode) {
      const world = screenToWorld(x, y);
      drag.simNode.x = world.x;
      drag.simNode.y = world.y;
      drag.simNode.vx = 0;
      drag.simNode.vy = 0;
      reheat(0.5);
    } else if (drag.mode === "pan") {
      transformRef.current.panX += x - drag.lastX;
      transformRef.current.panY += y - drag.lastY;
    }
    drag.lastX = x;
    drag.lastY = y;
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== e.pointerId) return;
    // Nauwelijks bewogen op een node -> als klik behandelen (detail openen).
    if (!drag.moved && drag.mode === "node" && drag.simNode) {
      const node = drag.simNode.node;
      selectedIdRef.current = node.id;
      setSelected(node);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // pointer was mogelijk al vrijgegeven
    }
    drag.mode = "none";
    drag.pointerId = null;
    drag.simNode = null;
    drag.moved = false;
  };

  // Scroll-zoom via een native, niet-passieve listener zodat preventDefault
  // werkt en de pagina niet meescrolt tijdens het zoomen boven de graaf.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const t = transformRef.current;
      const worldBefore = screenToWorld(sx, sy);
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.min(3, Math.max(0.35, t.zoom * factor));
      t.zoom = newZoom;
      const { width, height } = sizeRef.current;
      // Houd het punt onder de cursor vast tijdens zoomen.
      t.panX = sx - width / 2 - worldBefore.x * newZoom;
      t.panY = sy - height / 2 - worldBefore.y * newZoom;
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [screenToWorld]);

  const closeDetail = () => {
    selectedIdRef.current = null;
    setSelected(null);
  };

  return (
    <div ref={containerRef} className="relative h-[380px] w-full overflow-hidden rounded-xl sm:h-[520px]">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      />

      {selected && <NodeDetail node={selected} onClose={closeDetail} />}
    </div>
  );
}

function fmtDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function periodText(node: BrainNode): string | null {
  if (node.period_label) return node.period_label;
  const start = fmtDate(node.period_start);
  const end = fmtDate(node.period_end);
  if (start && end) return `${start} tot ${end}`;
  return start ?? end ?? null;
}

function NodeDetail({ node, onClose }: { node: BrainNode; onClose: () => void }) {
  const color = TYPE_COLORS[node.type];
  const period = periodText(node);

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:w-[320px]">
      <div className="pointer-events-auto rounded-2xl border border-border bg-card p-4 shadow-[0_16px_40px_rgba(31,41,51,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              {TYPE_LABELS[node.type]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex-none rounded-full p-1 text-muted-foreground transition hover:bg-card-hover hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="mt-2 text-[15px] font-bold leading-snug text-foreground">{node.label}</h3>

        {node.tags.length > 0 && (
          <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
            {node.tags.join(" · ")}
          </p>
        )}

        {node.why && (
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{node.why}</p>
        )}

        {(period || node.delta) && (
          <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
            {period && (
              <p className="text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">Periode:</span> {period}
              </p>
            )}
            {node.delta && (
              <p className="text-[12px] font-semibold text-accent">{node.delta}</p>
            )}
          </div>
        )}

        <Link
          href="/dashboard/chat"
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-[13px] font-semibold text-background transition hover:opacity-90"
        >
          Vraag Stevin hierover
        </Link>
      </div>
    </div>
  );
}
