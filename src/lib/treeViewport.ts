import { getGeneration, type AppSettings, type Person } from './familyData';

export interface TreeView {
  x: number;
  y: number;
  scale: number;
}
export interface ViewportSize {
  w: number;
  h: number;
}
export interface TreeBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export const DEFAULT_MIN_ZOOM = 0.2;
export const MAX_TREE_ZOOM = 3;

export function getGenerationOverride(settings: AppSettings, generation: number) {
  const overrides = settings.generationOverrides;
  if (!overrides) return null;
  // JSON/JSONB may contain string generation keys.
  return (
    overrides[generation] ??
    Object.entries(overrides).find(([key]) => Number(key) === generation)?.[1] ??
    null
  );
}

export function getNodeDimensions(
  person: Person,
  settings: AppSettings,
  personMap: Map<string, Person>
) {
  const override = getGenerationOverride(settings, getGeneration(person.id, personMap));
  const baseFontSize = override?.fontSize ?? person.cardFontSize ?? settings.baseFontSize;
  const scale = override?.scale ?? person.nodeScale ?? 1;
  const fs = baseFontSize * scale;
  const w = Math.max(
    0,
    person.cardWidth
      ? person.cardWidth * scale
      : Math.max(50 * scale, person.name.length * baseFontSize * 0.55 * scale + 20 * scale)
  );
  const h = Math.max(
    0,
    person.cardHeight ? person.cardHeight * scale : (baseFontSize + 20) * scale
  );
  return { w, h, fs, scale };
}

export function getNodeBounds(
  person: Person,
  dimensions: ReturnType<typeof getNodeDimensions>
): TreeBounds {
  // Custom cards can be narrower than their text. Keep a conservative text
  // extent as well, so long names cannot disappear while their card is offscreen.
  const halfWidth = Math.max(dimensions.w / 2, (person.name.length * dimensions.fs) / 2);
  const halfHeight = Math.max(dimensions.h / 2, dimensions.fs);
  return {
    left: person.manualX - halfWidth,
    top: person.manualY - halfHeight,
    right: person.manualX + halfWidth,
    bottom: person.manualY + halfHeight,
    width: halfWidth * 2,
    height: halfHeight * 2,
  };
}

export function getTreeBounds(
  persons: Person[],
  settings: AppSettings,
  personMap: Map<string, Person>
): TreeBounds | null {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  for (const person of persons) {
    const bounds = getNodeBounds(person, getNodeDimensions(person, settings, personMap));
    if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)) continue;
    left = Math.min(left, bounds.left);
    top = Math.min(top, bounds.top);
    right = Math.max(right, bounds.right);
    bottom = Math.max(bottom, bounds.bottom);
  }
  return Number.isFinite(left)
    ? {
        left,
        top,
        right,
        bottom,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
      }
    : null;
}

export function getFitView(bounds: TreeBounds | null, viewport: ViewportSize): TreeView {
  const w = Math.max(1, Number.isFinite(viewport.w) ? viewport.w : 1);
  const h = Math.max(1, Number.isFinite(viewport.h) ? viewport.h : 1);
  if (!bounds) return { x: w / 2, y: h / 2, scale: 0.5 };
  // Leave room for outlines, shadows and the floating controls on small screens.
  const padding = Math.min(48, w * 0.1, h * 0.1);
  const scale = Math.min((w - padding * 2) / bounds.width, (h - padding * 2) / bounds.height, 0.5);
  return {
    x: w / 2 - (bounds.left / 2 + bounds.right / 2) * scale,
    y: h / 2 - (bounds.top / 2 + bounds.bottom / 2) * scale,
    scale,
  };
}

export function getMinimumZoom(bounds: TreeBounds | null, viewport: ViewportSize): number {
  // Permit one further factor of two beyond the full-tree fit. No fixed floor
  // can accommodate trees whose width increases as more branches are added.
  return bounds
    ? Math.min(DEFAULT_MIN_ZOOM, getFitView(bounds, viewport).scale / 2)
    : DEFAULT_MIN_ZOOM;
}

export function clampTreeZoom(value: number, minZoom = DEFAULT_MIN_ZOOM): number {
  const minimum =
    Number.isFinite(minZoom) && minZoom > 0 ? Math.min(minZoom, MAX_TREE_ZOOM) : DEFAULT_MIN_ZOOM;
  return Math.min(Math.max(Number.isFinite(value) ? value : 1, minimum), MAX_TREE_ZOOM);
}

export function zoomAtPoint(
  view: TreeView,
  zoom: number,
  point: { x: number; y: number },
  minZoom = DEFAULT_MIN_ZOOM
): TreeView {
  const scale = Number.isFinite(view.scale) && view.scale > 0 ? view.scale : 1;
  const x = Number.isFinite(view.x) ? view.x : 0;
  const y = Number.isFinite(view.y) ? view.y : 0;
  const nextScale = clampTreeZoom(zoom, minZoom);
  return {
    x: point.x - ((point.x - x) / scale) * nextScale,
    y: point.y - ((point.y - y) / scale) * nextScale,
    scale: nextScale,
  };
}

export function intersectsViewport(
  bounds: TreeBounds,
  view: TreeView,
  viewport: ViewportSize,
  padding = 300
): boolean {
  return (
    bounds.right * view.scale + view.x >= -padding &&
    bounds.left * view.scale + view.x <= viewport.w + padding &&
    bounds.bottom * view.scale + view.y >= -padding &&
    bounds.top * view.scale + view.y <= viewport.h + padding
  );
}
