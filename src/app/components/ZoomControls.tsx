'use client';
import React from 'react';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export default function ZoomControls({ onZoomIn, onZoomOut, onFit }: Props) {
  return (
    <div
      className="no-print absolute bottom-6 left-6 flex flex-col gap-2 z-20 border-t-0 mt-0 mb-[38px] pt-0 border-b"
      style={{ direction: 'ltr' }}>

      <button onClick={onZoomIn} className="zoom-btn" aria-label="تكبير" title="تكبير">+</button>
      <button onClick={onFit} className="zoom-btn text-sm" aria-label="ملاءمة الشاشة" title="ملاءمة الشاشة">⌂</button>
      <button onClick={onZoomOut} className="zoom-btn" aria-label="تصغير" title="تصغير">−</button>
    </div>);

}