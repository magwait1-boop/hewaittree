'use client';

import React, { useState } from 'react';
import type { Person } from '@/lib/familyData';

interface Props {
  person: Person;
  onSave: (color: string, width: number, applyToDescendants: boolean) => void;
  onClose: () => void;
}

export default function EdgeStyleModal({ person, onSave, onClose }: Props) {
  const [color, setColor] = useState(person.edgeColor || '#ffffff');
  const [width, setWidth] = useState(person.edgeWidth ?? 2);
  const [applyToDescendants, setApplyToDescendants] = useState(false);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edge-style-title"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="edge-style-title" className="mb-4 text-lg font-bold">تخصيص خط الاتصال</h2>
        <label className="mb-4 flex items-center justify-between gap-4 text-sm">
          <span>لون الخط</span>
          <input
            aria-label="لون الخط"
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent"
          />
        </label>
        <label className="mb-4 block text-sm">
          <span className="mb-2 flex justify-between"><span>سُمك الخط</span><span>{width}px</span></span>
          <input
            aria-label="سُمك الخط"
            type="range"
            min={1}
            max={10}
            step={1}
            value={width}
            onChange={e => setWidth(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
        </label>
        <label className="mb-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={applyToDescendants}
            onChange={e => setApplyToDescendants(e.target.checked)}
            className="accent-amber-400"
          />
          تطبيق على كامل الذرية
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-white/10">إغلاق</button>
          <button type="button" onClick={() => onSave(color, width, applyToDescendants)} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300">حفظ التعديلات</button>
        </div>
      </section>
    </div>
  );
}
