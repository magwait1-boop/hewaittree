export interface PrintBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Measure the actual vector artwork, including text and the outside of borders. */
export function measurePrintBounds(content: SVGGElement): PrintBounds {
  // SVG text metrics can depend on the preview's scale. Measure with one user
  // unit per CSS pixel, then restore the declarative viewBox before painting.
  const svg = content.ownerSVGElement;
  const viewBox = svg?.getAttribute('viewBox');
  svg?.removeAttribute('viewBox');
  try {
    return measureArtwork(content);
  } finally {
    if (viewBox != null) svg?.setAttribute('viewBox', viewBox);
  }
}

function measureArtwork(content: SVGGElement): PrintBounds {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const element of content.querySelectorAll<SVGGraphicsElement>('rect, ellipse, path, text')) {
    const stroke = element.getAttribute('stroke');
    const fill = element.getAttribute('fill');
    const hasStroke = !!stroke && stroke !== 'none' && stroke !== 'transparent';
    if ((fill === 'none' || fill === 'transparent') && !hasStroke) continue;
    const box = element.getBBox();
    const strokePadding = hasStroke
      ? Math.max(0, Number(element.getAttribute('stroke-width')) || 0) / 2
      : 0;
    // Browsers round glyph outlines differently at preview and PDF scales.
    // A single SVG pixel protects text that extends beyond a custom card.
    const padding = strokePadding + (element.tagName.toLowerCase() === 'text' ? 1 : 0);
    left = Math.min(left, box.x - padding);
    top = Math.min(top, box.y - padding);
    right = Math.max(right, box.x + box.width + padding);
    bottom = Math.max(bottom, box.y + box.height + padding);
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 1, height: 1 };
  // Round outwards to SVG pixels: glyph metrics can vary by a fraction of a
  // pixel when the preview viewBox changes, and must never clip edge text.
  left = Math.floor(left);
  top = Math.floor(top);
  right = Math.ceil(right);
  bottom = Math.ceil(bottom);
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

export function getPrintPageSize(bounds: PrintBounds) {
  // Keep the natural physical size of the cards. Chromium/PDF supports pages
  // up to 200 inches; scale unusually large trees uniformly within that limit.
  const mmPerPixel = 25.4 / 96;
  const scale = Math.min(mmPerPixel, 5080 / Math.max(bounds.width, bounds.height));
  return { widthMm: bounds.width * scale, heightMm: bounds.height * scale };
}
