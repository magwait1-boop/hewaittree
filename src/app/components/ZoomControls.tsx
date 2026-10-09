'use client';
import React from 'react';

interface Props {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFit: () => void;
}

function clampZoom(value: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : 1, 0.2), 3);
}

export default function ZoomControls({ zoom, onZoomChange, onFit }: Props) {
  const safeZoom = clampZoom(zoom);
  return (
    <div
      className="no-print absolute bottom-6 left-6 flex flex-col gap-2 z-20 border-t-0 mt-0 mb-[38px] pt-0 border-b"
      style={{ direction: 'ltr' }}>

      <button onClick={() => onZoomChange(clampZoom(safeZoom * 1.2))} className="zoom-btn" aria-label="تكبير" title="تكبير">+</button>
      <button onClick={onFit} className="zoom-btn text-sm" aria-label="ملاءمة الشاشة" title="ملاءمة الشاشة">⌂</button>
      <button onClick={() => onZoomChange(clampZoom(safeZoom / 1.2))} className="zoom-btn" aria-label="تصغير" title="تصغير">−</button>
    </div>);

}
