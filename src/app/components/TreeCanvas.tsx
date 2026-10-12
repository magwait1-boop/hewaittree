'use client';
import React, { useRef, useCallback, useEffect, useLayoutEffect, useState, useMemo } from 'react';
import type { Person, AppSettings } from '@/lib/familyData';
import { getGeneration } from '@/lib/familyData';
import type { ViewState } from './FamilyTreeClient';
import { measurePrintBounds, getPrintPageSize, type PrintBounds } from '@/lib/treePrint';
import { clampTreeZoom, DEFAULT_MIN_ZOOM, getGenerationOverride, getNodeDimensions as measureNodeDimensions, getNodeBounds, intersectsViewport } from '@/lib/treeViewport';

interface Props {
  persons: Person[];
  view: ViewState;
  setView: React.Dispatch<React.SetStateAction<ViewState>>;
  settings: AppSettings;
  minZoom?: number;
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
  onPrintReady?: () => void;
  printBackground?: string;
}

interface CanvasSize { w: number; h: number; }

// Minimum movement (px) before a pointer-down is treated as a pan/drag, not a tap
const TAP_THRESHOLD = 5;
const MIN_PINCH_DISTANCE = 15;

interface PointerPosition { x: number; y: number; }

function isFinitePosition(point: PointerPosition | null | undefined): point is PointerPosition {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function getPinchGesture(pointers: Map<number, PointerPosition>) {
  const points = Array.from(pointers.values());
  if (points.length < 2) return null;
  const [first, second] = points;
  if (!isFinitePosition(first) || !isFinitePosition(second)) return null;

  const distance = Math.hypot(second.x - first.x, second.y - first.y);
  const midpoint = { x: first.x / 2 + second.x / 2, y: first.y / 2 + second.y / 2 };
  if (!Number.isFinite(distance) || distance < MIN_PINCH_DISTANCE || !isFinitePosition(midpoint)) return null;
  return { distance, midpoint };
}

function capturePointer(element: SVGElement, pointerId: number) {
  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // A pointer can end before capture, or capture may be unavailable.
  }
}

export default function TreeCanvas({
  persons, view, setView, settings, minZoom = DEFAULT_MIN_ZOOM,
  searchMatches, selectedIds, sidebarNodeId,
  onNodeClick, onNodeDblClick, onNodeDrag, onEdgeClick, canEditEdges = false, canDrag,
  personMap, onBgClick,
  isPrinting = false, onPrintDone, onPrintReady, printBackground = '#ffffff',
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const [printBounds, setPrintBounds] = useState<PrintBounds | null>(null);
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
  const activePointers = useRef<Map<number, PointerPosition>>(new Map());
  // Track total movement to distinguish tap from pan
  const pointerMoved = useRef(false);
  // Track pinch state
  const lastPinchDist = useRef<number | null>(null);
  const lastPinchMid = useRef<PointerPosition | null>(null);

  // Keep a stable ref to onPrintDone so the afterprint listener doesn't go stale
  const onPrintDoneRef = useRef(onPrintDone);
  useEffect(() => { onPrintDoneRef.current = onPrintDone; }, [onPrintDone]);
  const onPrintReadyRef = useRef(onPrintReady);
  useEffect(() => { onPrintReadyRef.current = onPrintReady; }, [onPrintReady]);

  useEffect(() => {
    const container = svgRef.current?.parentElement;
    const update = () => setCanvasSize({
      w: Math.max(0, container?.clientWidth ?? window.innerWidth),
      h: Math.max(0, container?.clientHeight ?? window.innerHeight - 112),
    });
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (container) observer?.observe(container);
    window.addEventListener('resize', update);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  const getGenOverride = useCallback((p: Person) => {
    const gen = getGeneration(p.id, personMap);
    return getGenerationOverride(settings, gen);
  }, [settings, personMap]);

  const nodeDimensions = useMemo(() => new Map(persons.map(person => [
    person.id, measureNodeDimensions(person, settings, personMap),
  ])), [persons, settings, personMap]);
  const getNodeDimensions = useCallback((p: Person) => nodeDimensions.get(p.id) ?? measureNodeDimensions(p, settings, personMap), [nodeDimensions, settings, personMap]);

  const safeZoom = clampTreeZoom(view.scale, minZoom);
  const safePanX = Number.isFinite(view.x) ? Math.round(view.x) : 0;
  const safePanY = Number.isFinite(view.y) ? Math.round(view.y) : 0;
  const drawingView = { x: safePanX, y: safePanY, scale: safeZoom };

  // Test the entire card/label, not just its center. The same sanitized view
  // drives culling and the SVG transform, including zoom levels below 20%.
  const visiblePersons = isPrinting ? persons : persons.filter(person =>
    intersectsViewport(getNodeBounds(person, getNodeDimensions(person)), drawingView, canvasSize));
  const visibleIds = new Set(visiblePersons.map(person => person.id));
  const visibleEdges = persons.filter(child => {
    if (!child.fatherId) return false;
    if (isPrinting || visibleIds.has(child.id) || visibleIds.has(child.fatherId)) return true;
    const parent = personMap.get(child.fatherId);
    if (!parent) return false;
    const fromY = parent.manualY + getNodeDimensions(parent).h / 2;
    const toY = child.manualY - getNodeDimensions(child).h / 2;
    // Every existing line style stays inside the bounds of its endpoints.
    // Keep an edge crossing the viewport even when both cards are offscreen.
    return intersectsViewport({
      left: Math.min(parent.manualX, child.manualX),
      right: Math.max(parent.manualX, child.manualX),
      top: Math.min(fromY, toY), bottom: Math.max(fromY, toY),
      width: Math.abs(child.manualX - parent.manualX), height: Math.abs(toY - fromY),
    }, drawingView, canvasSize);
  });

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
  const handleWheel = useCallback((e: WheelEvent) => {
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
      const ns = clampTreeZoom(rawScale, minZoom);
      const x = clientX - xs * ns;
      const y = clientY - ys * ns;
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y, scale: ns } : { x: currentX, y: currentY, scale: currentScale };
    });
  }, [setView, minZoom]);

  // Attach wheel zoom natively so the listener is explicitly non-passive.
  // Touch interactions use pointer events and CSS touch-action only.
  useEffect(() => {
    const element = svgRef.current;
    if (!element) return;

    const handleNativeWheel = (event: WheelEvent) => {
      if (event.cancelable) event.preventDefault();
      handleWheel(event);
    };

    element.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleNativeWheel);
  }, [handleWheel]);

  const beginPointer = useCallback((e: React.PointerEvent<SVGElement>, nodeId: string | null) => {
    if (!isFinitePosition({ x: e.clientX, y: e.clientY })) return;
    if (activePointers.current.size === 0) pointerMoved.current = false;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    bgPointerDown.current = false;
    capturePointer(svgRef.current ?? e.currentTarget, e.pointerId);

    if (activePointers.current.size >= 2) {
      // A second finger starts a pinch even when it lands on a node.
      pointerMoved.current = true;
      lastClickTime.current = 0;
      isDraggingNode.current = false;
      dragNodeId.current = null;
      clickedNodeId.current = null;
      isPanning.current = false;
      const gesture = getPinchGesture(activePointers.current);
      lastPinchDist.current = gesture?.distance ?? null;
      lastPinchMid.current = gesture?.midpoint ?? null;
      return;
    }

    lastPinchDist.current = null;
    lastPinchMid.current = null;
    if (!nodeId) {
      bgPointerDown.current = true;
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      return;
    }

    clickedNodeId.current = nodeId;
    const now = Date.now();
    if (now - lastClickTime.current < 350) {
      onNodeDblClick(nodeId);
      lastClickTime.current = 0;
      return;
    }
    lastClickTime.current = now;
    if (canDrag) {
      isDraggingNode.current = true;
      dragNodeId.current = nodeId;
      dragStart.current = { clientX: e.clientX, clientY: e.clientY };
    }
  }, [view.x, view.y, canDrag, onNodeDblClick]);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    beginPointer(e, null);
  }, [beginPointer]);

  const handleNodePointerDown = useCallback((e: React.PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    const id = e.currentTarget.getAttribute('data-node-id');
    if (id) beginPointer(e, id);
  }, [beginPointer]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const prev = activePointers.current.get(e.pointerId);
    if (!isFinitePosition(prev) || !isFinitePosition({ x: e.clientX, y: e.clientY })) return;
    if (Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > TAP_THRESHOLD) {
      pointerMoved.current = true;
    }
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size >= 2) {
      const gesture = getPinchGesture(activePointers.current);
      if (!gesture) {
        lastPinchDist.current = null;
        lastPinchMid.current = null;
        return;
      }

      // Snapshot gesture data before React queues the state update. Pointer-up
      // and subsequent moves can reset or replace these refs before it runs.
      const previousDistance = lastPinchDist.current;
      const previousMid = lastPinchMid.current;
      const { distance, midpoint } = gesture;
      lastPinchDist.current = distance;
      lastPinchMid.current = midpoint;
      if (previousDistance === null || !Number.isFinite(previousDistance) ||
          previousDistance <= MIN_PINCH_DISTANCE || !isFinitePosition(previousMid)) return;

      const ratio = distance / previousDistance;
      if (!Number.isFinite(ratio) || ratio <= 0.5 || ratio >= 2) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;
      const previousX = previousMid.x - rect.left;
      const previousY = previousMid.y - rect.top;
      const currentX = midpoint.x - rect.left;
      const currentY = midpoint.y - rect.top;

      setView(v => {
        const scale = Number.isFinite(v.scale) && v.scale > 0 ? v.scale : 1;
        const panX = Number.isFinite(v.x) ? v.x : 0;
        const panY = Number.isFinite(v.y) ? v.y : 0;
        const rawScale = scale * ratio;
        if (!Number.isFinite(rawScale)) return { x: panX, y: panY, scale };
        const nextScale = clampTreeZoom(rawScale, minZoom);
        const x = currentX - ((previousX - panX) / scale) * nextScale;
        const y = currentY - ((previousY - panY) / scale) * nextScale;
        return Number.isFinite(x) && Number.isFinite(y)
          ? { x, y, scale: nextScale }
          : { x: panX, y: panY, scale };
      });
      return;
    }

    lastPinchDist.current = null;
    lastPinchMid.current = null;
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
  }, [view.scale, onNodeDrag, setView, minZoom]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
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

  const handlePointerCancel = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.delete(e.pointerId);
    lastPinchDist.current = null;
    lastPinchMid.current = null;
    isDraggingNode.current = false;
    dragNodeId.current = null;
    isPanning.current = false;
    clickedNodeId.current = null;
    bgPointerDown.current = false;
    pointerMoved.current = true;
    lastClickTime.current = 0;
  }, []);

  const renderEdgePath = (parent: Person, child: Person): string => {
    const { h: ph } = getNodeDimensions(parent);
    const { h: ch } = getNodeDimensions(child);
    const fx = parent.manualX;
    const fy = parent.manualY + ph / 2;
    const nx = child.manualX;
    const ny = child.manualY - ch / 2;
    const my = (fy + ny) / 2;
    if (settings.lineStyle === 'straight') return `M ${fx} ${fy} L ${nx} ${ny}`;
    if (settings.lineStyle === 'step') return `M ${fx} ${fy} L ${fx} ${my} L ${nx} ${my} L ${nx} ${ny}`;
    return `M ${fx} ${fy} C ${fx} ${my}, ${nx} ${my}, ${nx} ${ny}`;
  };

  // Render every card at its original coordinates before measuring. Layout
  // effects also run synchronously when the browser's beforeprint event fires.
  useLayoutEffect(() => {
    if (!isPrinting || !contentRef.current) {
      setPrintBounds(null);
      return;
    }
    let cancelled = false;
    const measure = () => {
      if (!cancelled && contentRef.current) setPrintBounds(measurePrintBounds(contentRef.current));
    };
    measure();
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      measure();
      onPrintReadyRef.current?.();
    });
    return () => { cancelled = true; };
  }, [isPrinting, persons, getNodeDimensions, settings.lineStyle]);

  useLayoutEffect(() => {
    if (!isPrinting || !printBounds) return;
    const { widthMm, heightMm } = getPrintPageSize(printBounds);
    const style = document.createElement('style');
    style.textContent = `
      @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
      @media print {
        .family-tree {
          --tree-print-width: ${widthMm}mm;
          --tree-print-height: ${heightMm}mm;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, [isPrinting, printBounds]);

  useEffect(() => {
    if (!isPrinting) return;
    const handleAfterPrint = () => onPrintDoneRef.current?.();
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [isPrinting]);

  const transformStr = `translate(${safePanX}, ${safePanY}) scale(${safeZoom})`;
  const drawingScale = isPrinting ? 1 : safeZoom;
  const whitePaper = printBackground === '#ffffff';

  return (
    <svg
      ref={svgRef}
      width={Math.max(0, canvasSize.w)}
      height={Math.max(0, canvasSize.h)}
      viewBox={isPrinting && printBounds ? `${printBounds.x} ${printBounds.y} ${printBounds.width} ${printBounds.height}` : undefined}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', userSelect: 'none', touchAction: 'none', overscrollBehavior: 'none', background: isPrinting ? printBackground : undefined }}
      className="tree-svg touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
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
        width={Math.max(0, canvasSize.w)}
        height={Math.max(0, canvasSize.h)}
        fill="transparent"
        style={{ cursor: 'default' }}
      />

      <g ref={contentRef} data-tree-content transform={isPrinting ? undefined : transformStr}>
        {/* Edges */}
        <g>
          {visibleEdges.map(child => {
            const parent = personMap.get(child.fatherId);
            if (!parent) return null;
            const d = renderEdgePath(parent, child);
            const strokeColor = child.edgeColor || (isPrinting && whitePaper ? '#475569' : 'var(--tree-edge)');
            return (
              <g key={`edge-${child.id}`}>
                {!isPrinting && <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14 / drawingScale}
                  pointerEvents="stroke"
                  className={canEditEdges ? 'cursor-pointer' : undefined}
                  onPointerDown={e => { if (canEditEdges) e.stopPropagation(); }}
                  onMouseDown={e => { if (canEditEdges) e.stopPropagation(); }}
                  onClick={e => {
                    if (!canEditEdges) return;
                    e.stopPropagation();
                    onEdgeClick?.(child.id);
                  }}
                />}
                <path
                  d={d}
                  stroke={strokeColor}
                  strokeWidth={(child.edgeWidth ?? 2) / drawingScale}
                  fill="none"
                  strokeLinecap="round"
                  opacity={isPrinting ? 1 : 0.7}
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
            const isHighlighted = !isPrinting && searchMatches.includes(p.id);
            const isSelected = !isPrinting && p.id === sidebarNodeId;
            const isDescendant = !isPrinting && selectedIds.has(p.id);
            const isRoot = !p.fatherId;

            let strokeColor = isPrinting && whitePaper ? '#64748b' : 'var(--tree-node-border)';
            let strokeWidth = 1 / drawingScale;
            let filterAttr = 'url(#shadow)';

            if (p.cardBorderColor) strokeColor = p.cardBorderColor;
            if (p.cardBorderWidth !== undefined) strokeWidth = p.cardBorderWidth / drawingScale;

            if (isHighlighted) { strokeColor = '#fbbf24'; strokeWidth = 4 / drawingScale; filterAttr = 'url(#glow-highlight)'; }
            else if (isRoot) { strokeColor = p.cardBorderColor || '#e1d019'; strokeWidth = (p.cardBorderWidth ?? 3) / drawingScale; filterAttr = 'url(#glow-root)'; }
            else if (isDescendant) { strokeColor = '#c084fc'; strokeWidth = 4 / drawingScale; filterAttr = 'url(#glow-descendant)'; }
            else if (isSelected) { strokeColor = '#38bdf8'; strokeWidth = 3 / drawingScale; filterAttr = 'url(#glow-selected)'; }

            const x = p.manualX;
            const y = p.manualY;
            const customRadius = p.cardBorderRadius !== undefined ? p.cardBorderRadius * scale : undefined;
            const textColor = p.cardTextColor || '#0f172a';

            return (
              <g
                key={`node-${p.id}`}
                data-node-id={p.id}
                className="node-group"
                filter={isPrinting ? undefined : filterAttr}
                onPointerDown={handleNodePointerDown}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                {shape === 'ellipse' ? (
                  <ellipse
                    cx={x} cy={y}
                    rx={Math.max(0, w / 2)} ry={Math.max(0, h / 2)}
                    fill={color}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                  />
                ) : (
                  <rect
                    x={x - w / 2} y={y - h / 2}
                    width={Math.max(0, w)} height={Math.max(0, h)}
                    rx={Math.max(0, customRadius !== undefined ? customRadius : (shape === 'pill' ? h / 2 : 8 * scale))}
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
          fill="var(--muted-foreground)"
          fontSize={18}
          fontFamily="Tajawal, sans-serif"
        >
          لا توجد بيانات — قم باستيراد ملف أو إضافة أشخاص
        </text>
      )}
    </svg>
  );
}
