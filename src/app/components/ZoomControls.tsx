'use client';
import React from 'react';
import { clampTreeZoom, DEFAULT_MIN_ZOOM, MAX_TREE_ZOOM } from '@/lib/treeViewport';

interface Props {
  zoom: number;
  minZoom?: number;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
}

export default function ZoomControls({ zoom, minZoom = DEFAULT_MIN_ZOOM, onZoomChange, onFit }: Props) {
  const safeZoom = clampTreeZoom(zoom, minZoom);
  return (
    <div
      className="no-print absolute bottom-6 left-6 flex flex-col gap-2 z-20 border-t-0 mt-0 mb-[38px] pt-0 border-b"
      style={{ direction: 'ltr' }}>

      <button type="button" disabled={safeZoom >= MAX_TREE_ZOOM} onClick={() => onZoomChange(clampTreeZoom(safeZoom * 1.2, minZoom))} className="zoom-btn" aria-label="تكبير" title="تكبير">+</button>
      <button type="button" onClick={onFit} className="zoom-btn text-sm" aria-label="ملاءمة الشجرة كاملة" title="ملاءمة الشجرة كاملة">⌂</button>
      <button type="button" disabled={safeZoom <= minZoom} onClick={() => onZoomChange(clampTreeZoom(safeZoom / 1.2, minZoom))} className="zoom-btn" aria-label="تصغير" title="تصغير">−</button>
    </div>);

}
