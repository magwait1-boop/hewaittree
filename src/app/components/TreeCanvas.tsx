'use client';
import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { Person, AppSettings } from '@/lib/familyData';
import { getGeneration } from '@/lib/familyData';
import type { ViewState } from './FamilyTreeClient';

interface Props {
  persons: Person[];
  view: ViewState;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  settings: AppSettings;
  searchMatches: string[];
  selectedIds: Set<string>;
  sidebarNodeId: string | null;
  onNodeClick: (id: string) => void;
  onNodeDblClick: (id: string) => void;
  onNodeDrag: (id: string, dx: number, dy: number) => void;
  onEdgeClick?: (childId: string) => void;
  canEditEdges?: boolean;
  canDrag: boolean;
  personMap: Map<string, Person>;
  childrenMap: Map<string, string[]>;
  onBgClick?: () => void;
  isPrinting?: boolean;
  onPrintDone?: () => void;
}

interface CanvasSize { w: number; h: number; }

// Minimum movement (px) before a pointer-down is treated as a pan/drag, not a tap
const TAP_THRESHOLD = 5;

function getGenerationOverride(settings: AppSettings, generation: number) {
  const overrides = settings.generationOverrides;
  if (!overrides) return null;
  // Object keys become strings in JSON/JSONB; normalize lookup by generation
  // number so either representation (including "10") resolves identically.
  return overrides[generation] ?? Object.entries(overrides).find(([key]) => Number(key) === generation)?.[1] ?? null;
}

// ─── A0 Print helpers ────────────────────────────────────────────────────────

/** Calculate the tight bounding box of all active nodes */
function calcBoundingBox(
  persons: Person[],
  getDims: (p: Person) => { w: number; h: number }
) {
  if (persons.length === 0) return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of persons) {
    const { w, h } = getDims(p);
    minX = Math.min(minX, p.manualX - w / 2);
    maxX = Math.max(maxX, p.manualX + w / 2);
    minY = Math.min(minY, p.manualY - h / 2);
    maxY = Math.max(maxY, p.manualY + h / 2);
  }
  return { minX, minY, maxX, maxY };
}

export default function TreeCanvas({
  persons, view, setView, settings,
  searchMatches, selectedIds, sidebarNodeId,
  onNodeClick, onNodeDblClick, onNodeDrag, onEdgeClick, canEditEdges = false, canDrag,
  personMap, childrenMap, onBgClick,
  isPrinting = false, onPrintDone,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ w: 1440, h: 900 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const isDraggingNode = useRef(false);
  const dragNodeId = useRef<string | null>(null);
  const dragStart = useRef({ clientX: 0, clientY: 0 });
  const clickedNodeId = useRef<string | null>(null);
  const lastClickTime = useRef(0);
  // Track whether the bg was the pointer-down target (for deselect)
  const bgPointerDown = useRef(false);

  // Track active pointer count for pinch-zoom disambiguation
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Track total movement to distinguish tap from pan
  const pointerMoved = useRef(false);
  // Track pinch state
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchMid = useRef<{ x: number; y: number } | null>(null);

  // Keep a stable ref to onPrintDone so the afterprint listener doesn't go stale
  const onPrintDoneRef = useRef(onPrintDone);
  useEffect(() => { onPrintDoneRef.current = onPrintDone; }, [onPrintDone]);

  useEffect(() => {
    const update = () => setCanvasSize({ w: window.innerWidth, h: window.innerHeight - 112 });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Keep wheel zoom local to the canvas. Touch gestures are handled by pointer
  // events and CSS touch-action, without canceling touch events in JavaScript.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const preventDefaultWheel = (e: WheelEvent) => { if (e.cancelable) e.preventDefault(); };

    el.addEventListener('wheel', preventDefaultWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', preventDefaultWheel);
    };
  }, []);

  // Virtual rendering — only draw nodes in viewport + padding
  const PADDING = 300;
  const visiblePersons = isPrinting
    ? persons
    : persons.filter(p => {
        const sx = p.manualX * view.scale + view.x;
        const sy = p.manualY * view.scale + view.y;
        return sx > -PADDING && sx < canvasSize.w + PADDING &&
               sy > -PADDING && sy < canvasSize.h + PADDING;
      });

  const visibleIds = new Set(visiblePersons.map(p => p.id));

  const visibleEdges = persons.filter(p => {
    if (!p.fatherId) return false;
    return visibleIds.has(p.id) || visibleIds.has(p.fatherId);
  });

  const getGenOverride = useCallback((p: Person) => {
    const gen = getGeneration(p.id, personMap);
    return getGenerationOverride(settings, gen);
  }, [settings.generationOverrides, personMap]);

  const getNodeDimensions = useCallback((p: Person) => {
    const genOverride = getGenOverride(p);
    // Generation settings are applied after the node-specific defaults so a
    // generation-wide change also reaches nodes with saved per-node styling.
    const baseFontSize = genOverride?.fontSize ?? p.cardFontSize ?? settings.baseFontSize;
    const scale = genOverride?.scale ?? p.nodeScale ?? 1;
    const fs = baseFontSize * scale;
    const w = p.cardWidth
      ? p.cardWidth * scale
      : Math.max(50 * scale, p.name.length * baseFontSize * 0.55 * scale + 20 * scale);
    const h = p.cardHeight
      ? p.cardHeight * scale
      : (baseFontSize + 20) * scale;
    return { w, h, fs, scale };
  }, [settings.baseFontSize, getGenOverride]);

  const getShape = useCallback((p: Person): 'rect' | 'pill' | 'ellipse' => {
    if (p.gender === 'ذكر') return settings.maleShape;
    if (p.gender === 'أنثى') return settings.femaleShape;
    return settings.maleShape;
  }, [settings.maleShape, settings.femaleShape]);

  const getNodeColor = useCallback((p: Person): string => {
    const genOverride = getGenOverride(p);
    if (genOverride) return genOverride.color;
    if (p.cardBgColor) return p.cardBgColor;
    if (p.leafColor) return p.leafColor;
    if (p.gender === 'أنثى') return '#fcd9d9';
    return '#add7a0';
  }, [getGenOverride]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    setView(v => {
      const currentScale = Number.isFinite(v.scale) && v.scale > 0 ? v.scale : 1;
      const currentX = Number.isFinite(v.x) ? v.x : 0;
      const currentY = Number.isFinite(v.y) ? v.y : 0;
      const xs = (clientX - currentX) / currentScale;
      const ys = (clientY - currentY) / currentScale;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const rawScale = currentScale * factor;
      if (!Number.isFinite(rawScale)) return { x: currentX, y: currentY, scale: currentScale };
      const ns = Math.max(0.2, Math.min(3, rawScale));
      const x = clientX - xs * ns;
      const y = clientY - ys * ns;
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y, scale: ns } : { x: currentX, y: currentY, scale: currentScale };
    });
  }, [setView]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pointerMoved.current = false;
    bgPointerDown.current = false;

    if (activePointers.current.size >= 2) {
      isDraggingNode.current = false;
      dragNodeId.current = null;
      clickedNodeId.current = null;
      isPanning.current = false;
      const pts = Array.from(activePointers.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const initialPinchDist = Math.hypot(dx, dy);
      lastPinchDist.current = initialPinchDist >= 10 ? initialPinchDist : null;
      lastPinchMid.current = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      return;
    }

    // Background pointer-down — track for deselect
    bgPointerDown.current = true;

    // Pan
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  }, [view.x, view.y, canDrag, onNodeDblClick]);

  const handleNodePointerDown = useCallback((e: React.PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    // Reuse the canvas pointer bookkeeping while preventing this event from
    // reaching the SVG's background handler.
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pointerMoved.current = false;
    bgPointerDown.current = false;
    const id = e.currentTarget.getAttribute('data-node-id');
    if (!id) return;
    clickedNodeId.current = id;
    const now = Date.now();
    if (now - lastClickTime.current < 350) {
      onNodeDblClick(id);
      lastClickTime.current = 0;
      return;
    }
    lastClickTime.current = now;
    if (canDrag) {
      isDraggingNode.current = true;
      dragNodeId.current = id;
      dragStart.current = { clientX: e.clientX, clientY: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [canDrag, onNodeDblClick]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (activePointers.current.has(e.pointerId)) {
      const prev = activePointers.current.get(e.pointerId)!;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.sqrt(dx * dx + dy * dy) > TAP_THRESHOLD) {
        pointerMoved.current = true;
      }
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values());
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);
      const mid = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };

      const lastDist = lastPinchDist.current;
      const prevDistance = lastDist;
      const currentDistance = dist;
      if (!prevDistance || prevDistance < 10 || currentDistance < 10) {
        lastPinchDist.current = dist;
        lastPinchMid.current = mid;
        return;
      }
      if (lastPinchMid.current !== null) {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          const cx = mid.x - rect.left;
          const cy = mid.y - rect.top;
          const ratio = dist / lastDist;
          if (!Number.isFinite(ratio)) return;
          setView(v => {
            const currentScale = Number.isFinite(v.scale) && v.scale > 0 ? v.scale : 1;
            const currentX = Number.isFinite(v.x) ? v.x : 0;
            const currentY = Number.isFinite(v.y) ? v.y : 0;
            const xs = (cx - currentX) / currentScale;
            const ys = (cy - currentY) / currentScale;
            const rawScale = currentScale * ratio;
            if (!Number.isFinite(rawScale)) return { x: currentX, y: currentY, scale: currentScale };
            const ns = Math.max(0.2, Math.min(3, rawScale));
            const pmx = mid.x - lastPinchMid.current!.x;
            const pmy = mid.y - lastPinchMid.current!.y;
            const x = cx - xs * ns + pmx;
            const y = cy - ys * ns + pmy;
            return Number.isFinite(ns) && Number.isFinite(x) && Number.isFinite(y)
              ? { x, y, scale: ns }
              : { x: currentX, y: currentY, scale: currentScale };
          });
        }
      }

      lastPinchDist.current = dist;
      lastPinchMid.current = mid;
      return;
    }

    if (isDraggingNode.current && dragNodeId.current) {
      const safeScale = Number.isFinite(view.scale) && view.scale > 0 ? view.scale : 1;
      const dx = (e.clientX - dragStart.current.clientX) / safeScale;
      const dy = (e.clientY - dragStart.current.clientY) / safeScale;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      dragStart.current = { clientX: e.clientX, clientY: e.clientY };
      onNodeDrag(dragNodeId.current, dx, dy);
      return;
    }
    if (isPanning.current) {
      const x = panStart.current.vx + (e.clientX - panStart.current.x);
      const y = panStart.current.vy + (e.clientY - panStart.current.y);
      if (Number.isFinite(x) && Number.isFinite(y)) setView(v => ({ ...v, x, y }));
    }
  }, [view.scale, onNodeDrag, setView]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size < 2) {
      lastPinchDist.current = null;
      lastPinchMid.current = null;
    }

    if (isDraggingNode.current) {
      isDraggingNode.current = false;
      dragNodeId.current = null;
    }
    if (isPanning.current) {
      isPanning.current = false;
    }

    // Fire node click only if pointer didn't move significantly
    if (clickedNodeId.current && !pointerMoved.current && activePointers.current.size === 0) {
      onNodeClick(clickedNodeId.current);
    }

    // ── FIX: deselect when tapping empty canvas background ──
    if (bgPointerDown.current && !pointerMoved.current && activePointers.current.size === 0 && !clickedNodeId.current) {
      onBgClick?.();
    }

    clickedNodeId.current = null;
    bgPointerDown.current = false;
    pointerMoved.current = false;
  }, [onNodeClick, onBgClick]);

  const renderEdgePath = (parent: Person, child: Person): string => {
    const { w: pw, h: ph } = getNodeDimensions(parent);
    const { w: cw, h: ch } = getNodeDimensions(child);
    const fx = parent.manualX;
    const fy = parent.manualY + ph / 2;
    const nx = child.manualX;
    const ny = child.manualY - ch / 2;
    const my = (fy + ny) / 2;
    if (settings.lineStyle === 'straight') return `M ${fx} ${fy} L ${nx} ${ny}`;
    if (settings.lineStyle === 'step') return `M ${fx} ${fy} L ${fx} ${my} L ${nx} ${my} L ${nx} ${ny}`;
    return `M ${fx} ${fy} C ${fx} ${my}, ${nx} ${my}, ${nx} ${ny}`;
  };

  // ─── Step 1: When isPrinting becomes true, set up the SVG for full-tree print ───
  // This effect runs after React has rendered all 2000+ nodes into the DOM.
  useEffect(() => {
    if (!isPrinting) return;
    if (!svgRef.current || persons.length === 0) return;

    // Calculate tight bounding box from ALL nodes
    const getDims = (p: Person) => {
      const genOverride = (() => {
        const gen = getGeneration(p.id, personMap);
        return getGenerationOverride(settings, gen);
      })();
      const baseFontSize = genOverride?.fontSize ?? p.cardFontSize ?? settings.baseFontSize;
      const scale = genOverride?.scale ?? p.nodeScale ?? 1;
      const w = p.cardWidth
        ? p.cardWidth * scale
        : Math.max(50 * scale, p.name.length * baseFontSize * 0.55 * scale + 20 * scale);
      const h = p.cardHeight
        ? p.cardHeight * scale
        : (baseFontSize + 20) * scale;
      return { w, h };
    };

    const { minX, minY, maxX, maxY } = calcBoundingBox(persons, getDims);
    const PAD = 150;
    const vbX = minX - PAD;
    const vbY = minY - PAD - 120; // extra top space for title badge
    const vbW = maxX - minX + PAD * 2;
    const vbH = maxY - minY + PAD * 2 + 120;

    svgRef.current.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
    svgRef.current.setAttribute('width', '100%');
    svgRef.current.setAttribute('height', '100%');

    // Inject print title badge if not already present
    if (!svgRef.current.querySelector('#print-title-badge')) {
      const ns = 'http://www.w3.org/2000/svg';
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('id', 'print-title-badge');

      const badgeW = Math.min(vbW * 0.6, 1800);
      const badgeH = 110;
      const badgeX = vbX + vbW / 2 - badgeW / 2;
      const badgeY = vbY + 10;

      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', String(badgeX));
      rect.setAttribute('y', String(badgeY));
      rect.setAttribute('width', String(badgeW));
      rect.setAttribute('height', String(badgeH));
      rect.setAttribute('rx', '16');
      rect.setAttribute('fill', '#0f172a');
      rect.setAttribute('stroke', '#e1d019');
      rect.setAttribute('stroke-width', '3');
      g.appendChild(rect);

      const cx = String(vbX + vbW / 2);

      const t1 = document.createElementNS(ns, 'text');
      t1.setAttribute('x', cx);
      t1.setAttribute('y', String(badgeY + 34));
      t1.setAttribute('text-anchor', 'middle');
      t1.setAttribute('font-family', 'Tajawal, Arial, sans-serif');
      t1.setAttribute('font-size', '28');
      t1.setAttribute('font-weight', 'bold');
      t1.setAttribute('fill', '#e1d019');
      t1.setAttribute('direction', 'rtl');
      t1.textContent = 'شجرة عائلة آل حويت بكفر هلال';
      g.appendChild(t1);

      const t2 = document.createElementNS(ns, 'text');
      t2.setAttribute('x', cx);
      t2.setAttribute('y', String(badgeY + 64));
      t2.setAttribute('text-anchor', 'middle');
      t2.setAttribute('font-family', 'Tajawal, Arial, sans-serif');
      t2.setAttribute('font-size', '20');
      t2.setAttribute('fill', '#94a3b8');
      t2.setAttribute('direction', 'rtl');
      t2.textContent = `إجمالي أفراد العائلة: ${persons.length.toLocaleString('ar-EG')}`;
      g.appendChild(t2);

      const t3 = document.createElementNS(ns, 'text');
      t3.setAttribute('x', cx);
      t3.setAttribute('y', String(badgeY + 96));
      t3.setAttribute('text-anchor', 'middle');
      t3.setAttribute('font-family', 'Tajawal, Arial, sans-serif');
      t3.setAttribute('font-size', '18');
      t3.setAttribute('fill', '#cbd5e1');
      t3.setAttribute('direction', 'rtl');
      t3.textContent = 'تم التطوير وجمع البيانات بواسطة: م. مجدي حويت & م. عبداللطيف حويت';
      g.appendChild(t3);

      svgRef.current.insertBefore(g, svgRef.current.firstChild);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrinting, persons]);

  // ─── Step 3: After print dialog closes, restore SVG and reset isPrinting ───
  useEffect(() => {
    if (!isPrinting) return;

    const handleAfterPrint = () => {
      if (svgRef.current) {
        svgRef.current.removeAttribute('viewBox');
        svgRef.current.setAttribute('width', String(canvasSize.w));
        svgRef.current.setAttribute('height', String(canvasSize.h));
        const badge = svgRef.current.querySelector('#print-title-badge');
        if (badge) badge.remove();
      }
      onPrintDoneRef.current?.();
    };

    window.addEventListener('afterprint', handleAfterPrint, { once: true });

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isPrinting, canvasSize.w, canvasSize.h]);

  const safeZoom = Math.min(Math.max(Number.isFinite(view.scale) ? view.scale : 1, 0.2), 3.0);
  const safePanX = Number.isFinite(view.x) ? Math.round(view.x) : 0;
  const safePanY = Number.isFinite(view.y) ? Math.round(view.y) : 0;
  const transformStr = `translate(${safePanX}, ${safePanY}) scale(${safeZoom})`;

  return (
    <svg
      ref={svgRef}
      width={canvasSize.w}
      height={canvasSize.h}
      style={{ display: 'block', userSelect: 'none', touchAction: 'none' }}
      className="touch-none"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <defs>
        <filter id="shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.45" floodColor="#000" />
        </filter>
        <filter id="glow-highlight">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodOpacity="0.9" floodColor="#fbbf24" />
        </filter>
        <filter id="glow-selected">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodOpacity="0.8" floodColor="#38bdf8" />
        </filter>
        <filter id="glow-descendant">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodOpacity="0.7" floodColor="#c084fc" />
        </filter>
        <filter id="glow-root">
          <feDropShadow dx="0" dy="0" stdDeviation="10" floodOpacity="0.8" floodColor="#e1d019" />
        </filter>
      </defs>

      {/* Transparent background rect — captures bg clicks for deselect */}
      <rect
        x={0} y={0}
        width={canvasSize.w}
        height={canvasSize.h}
        fill="transparent"
        style={{ cursor: 'default' }}
      />

      <g transform={transformStr}>
        {/* Edges */}
        <g>
          {visibleEdges.map(child => {
            const parent = personMap.get(child.fatherId);
            if (!parent) return null;
            const d = renderEdgePath(parent, child);
            const strokeColor = child.edgeColor || 'rgba(255,255,255,0.25)';
            return (
              <g key={`edge-${child.id}`}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14 / view.scale}
                  pointerEvents="stroke"
                  className={canEditEdges ? 'cursor-pointer' : undefined}
                  onPointerDown={e => { if (canEditEdges) e.stopPropagation(); }}
                  onMouseDown={e => { if (canEditEdges) e.stopPropagation(); }}
                  onClick={e => {
                    if (!canEditEdges) return;
                    e.stopPropagation();
                    onEdgeClick?.(child.id);
                  }}
                />
                <path
                  d={d}
                  stroke={strokeColor}
                  strokeWidth={(child.edgeWidth ?? 2) / view.scale}
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.7}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {visiblePersons.map(p => {
            const { w, h, fs, scale } = getNodeDimensions(p);
            const shape = getShape(p);
            const color = getNodeColor(p);
            const isHighlighted = searchMatches.includes(p.id);
            const isSelected = p.id === sidebarNodeId;
            const isDescendant = selectedIds.has(p.id);
            const isRoot = !p.fatherId;

            let strokeColor = 'rgba(255,255,255,0.2)';
            let strokeWidth = 1 / view.scale;
            let filterAttr = 'url(#shadow)';

            if (p.cardBorderColor) strokeColor = p.cardBorderColor;
            if (p.cardBorderWidth !== undefined) strokeWidth = p.cardBorderWidth / view.scale;

            if (isRoot) { strokeColor = p.cardBorderColor || '#e1d019'; strokeWidth = (p.cardBorderWidth ?? 3) / view.scale; filterAttr = 'url(#glow-root)'; }
            else if (isHighlighted) { strokeColor = '#fbbf24'; strokeWidth = 4 / view.scale; filterAttr = 'url(#glow-highlight)'; }
            else if (isDescendant) { strokeColor = '#c084fc'; strokeWidth = 4 / view.scale; filterAttr = 'url(#glow-descendant)'; }
            else if (isSelected) { strokeColor = '#38bdf8'; strokeWidth = 3 / view.scale; filterAttr = 'url(#glow-selected)'; }

            const x = p.manualX;
            const y = p.manualY;
            const customRadius = p.cardBorderRadius !== undefined ? p.cardBorderRadius * scale : undefined;
            const textColor = p.cardTextColor || '#0f172a';

            return (
              <g
                key={`node-${p.id}`}
                data-node-id={p.id}
                className="node-group"
                filter={filterAttr}
                onPointerDown={handleNodePointerDown}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                {shape === 'ellipse' ? (
                  <ellipse
                    cx={x} cy={y}
                    rx={w / 2} ry={h / 2}
                    fill={color}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                  />
                ) : (
                  <rect
                    x={x - w / 2} y={y - h / 2}
                    width={w} height={h}
                    rx={customRadius !== undefined ? customRadius : (shape === 'pill' ? h / 2 : 8 * scale)}
                    fill={color}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                  />
                )}
                <text
                  x={x} y={y}
                  fontSize={fs}
                  className="node-svg-text"
                  fill={textColor}
                >
                  {p.name}
                </text>
              </g>
            );
          })}
        </g>
      </g>

      {/* Empty state */}
      {persons.length === 0 && (
        <text
          x={canvasSize.w / 2} y={canvasSize.h / 2}
          textAnchor="middle"
          fill="rgba(255,255,255,0.2)"
          fontSize={18}
          fontFamily="Tajawal, sans-serif"
        >
          لا توجد بيانات — قم باستيراد ملف أو إضافة أشخاص
        </text>
      )}
    </svg>
  );
}
