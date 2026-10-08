'use client';
import React, { useState } from 'react';
import type { AppSettings } from '@/lib/familyData';


interface Props {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

const GENERATION_INFO = [
  { gen: 1, label: 'الجيل الأول', desc: 'الجذر — حويت', defaultColor: '#e1d019', defaultScale: 3 },
  { gen: 2, label: 'الجيل الثاني', desc: 'أبناء حويت المباشرون', defaultColor: '#add7a0', defaultScale: 1.4 },
  { gen: 3, label: 'الجيل الثالث', desc: 'أحفاد حويت', defaultColor: '#add7a0', defaultScale: 1.2 },
  { gen: 4, label: 'الجيل الرابع', desc: 'أبناء الأحفاد', defaultColor: '#add7a0', defaultScale: 1 },
  { gen: 5, label: 'الجيل الخامس', desc: 'الذرية الخامسة', defaultColor: '#fdffb6', defaultScale: 1 },
  { gen: 6, label: 'الجيل السادس', desc: 'الذرية السادسة', defaultColor: '#add7a0', defaultScale: 0.9 },
  { gen: 7, label: 'الجيل السابع', desc: 'الذرية السابعة', defaultColor: '#add7a0', defaultScale: 0.9 },
  { gen: 8, label: 'الجيل الثامن', desc: 'الذرية الثامنة', defaultColor: '#add7a0', defaultScale: 0.8 },
  { gen: 9, label: 'الجيل التاسع', desc: 'الذرية التاسعة', defaultColor: '#add7a0', defaultScale: 0.8 },
];

/** Immediately persist the full settings object to localStorage and notify all listeners */
function persistSettings(updatedSettings: AppSettings) {
  try {
    localStorage.setItem('fam_settings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new CustomEvent('fam_settings_changed', { detail: updatedSettings }));
  } catch {}
}

export default function GenerationColorsPanel({ settings, onUpdate }: Props) {
  const [appliedGen, setAppliedGen] = useState<number | null>(null);

  const getOverride = (gen: number) => settings.generationOverrides?.[gen];

  const updateGeneration = (gen: number, patch: Partial<{ color: string; scale: number; fontSize: number }>) => {
    const info = GENERATION_INFO.find(g => g.gen === gen);
    const current = getOverride(gen) || {
      color: info?.defaultColor || '#add7a0',
      scale: info?.defaultScale ?? 1,
      fontSize: settings.baseFontSize,
    };
    // Build new overrides: preserve ALL existing keys, only update the target generation
    const newOverrides = {
      ...(settings.generationOverrides || {}),
      [gen]: { ...current, ...patch },
    };
    const updatedSettings: AppSettings = { ...settings, generationOverrides: newOverrides };
    // Update parent state
    onUpdate({ generationOverrides: newOverrides });
    // Immediately persist so tree reflects changes right away
    persistSettings(updatedSettings);
  };

  const handleApply = (gen: number) => {
    // Visual feedback
    setAppliedGen(gen);
    setTimeout(() => setAppliedGen(null), 1200);
    // Always persist the full current settings (including this generation's current values)
    const info = GENERATION_INFO.find(g => g.gen === gen);
    const current = getOverride(gen) || {
      color: info?.defaultColor || '#add7a0',
      scale: info?.defaultScale ?? 1,
      fontSize: settings.baseFontSize,
    };
    const newOverrides = {
      ...(settings.generationOverrides || {}),
      [gen]: { ...current },
    };
    const updatedSettings: AppSettings = { ...settings, generationOverrides: newOverrides };
    onUpdate({ generationOverrides: newOverrides });
    persistSettings(updatedSettings);
  };

  const resetGeneration = (gen: number) => {
    const overrides = { ...(settings.generationOverrides || {}) };
    delete overrides[gen];
    const updatedSettings: AppSettings = { ...settings, generationOverrides: overrides };
    onUpdate({ generationOverrides: overrides });
    persistSettings(updatedSettings);
  };

  const handleResetAll = () => {
    const updatedSettings: AppSettings = { ...settings, generationOverrides: {} };
    onUpdate({ generationOverrides: {} });
    persistSettings(updatedSettings);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-black text-foreground mb-1">ألوان وأحجام الأجيال</h2>
        <p className="text-sm text-muted-foreground">
          خصص لون وحجم عقد كل جيل على حدة — يُطبق على جميع أفراد الجيل المحدد
        </p>
      </div>

      <div className="settings-section">
        <div className="flex items-center justify-between mb-3">
          <span className="settings-label">تخصيص الأجيال</span>
          <button
            onClick={handleResetAll}
            className="btn-base text-xs btn-danger"
          >
            إعادة ضبط الكل
          </button>
        </div>

        {/* Column headers */}
        <div
          className="grid gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground border-b border-white/10 mb-2"
          style={{ gridTemplateColumns: '120px 50px 100px 90px 80px' }}
        >
          <span>الجيل</span>
          <span>اللون</span>
          <span>المقياس</span>
          <span>حجم الخط</span>
          <span>إجراء</span>
        </div>

        <div className="space-y-1">
          {GENERATION_INFO.map(info => {
            const override = getOverride(info.gen);
            const currentColor = override?.color || info.defaultColor;
            const currentScale = override?.scale ?? info.defaultScale;
            const currentFontSize = override?.fontSize ?? settings.baseFontSize;
            const isCustomized = !!override;

            return (
              <div
                key={`gen-row-${info.gen}`}
                className="grid gap-2 px-2 py-2 rounded-lg items-center hover:bg-white/03 transition-colors"
                style={{ gridTemplateColumns: '120px 50px 100px 90px 80px' }}
              >
                {/* Label */}
                <div>
                  <div className="text-xs font-bold text-foreground/90 flex items-center gap-1.5">
                    {isCustomized && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                    {info.label}
                  </div>
                  <div className="text-xs text-muted-foreground leading-tight">{info.desc}</div>
                </div>

                {/* Color */}
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={currentColor}
                    onChange={e => updateGeneration(info.gen, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-white/20 bg-transparent"
                    style={{ padding: '2px' }}
                    title="اختر اللون"
                  />
                </div>

                {/* Scale — extended range: 0.1 to 3.0, step 0.05 */}
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    value={currentScale}
                    onChange={e => updateGeneration(info.gen, { scale: parseFloat(e.target.value) })}
                    className="range-input flex-1"
                    style={{ minWidth: 0 }}
                  />
                  <span className="text-xs tabular-nums text-muted-foreground w-8 text-left">{currentScale.toFixed(2)}</span>
                </div>

                {/* Font size */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={8}
                    max={40}
                    value={currentFontSize}
                    onChange={e => updateGeneration(info.gen, { fontSize: parseInt(e.target.value) || settings.baseFontSize })}
                    className="custom-input text-center text-xs py-1.5 px-2 w-full tabular-nums"
                    style={{ height: '32px' }}
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApply(info.gen)}
                    className="btn-base btn-primary text-xs px-2 py-1"
                    title="تطبيق فوري على الشجرة"
                  >
                    {appliedGen === info.gen ? '✓' : 'تطبيق'}
                  </button>
                  {isCustomized && (
                    <button
                      onClick={() => resetGeneration(info.gen)}
                      className="btn-base btn-danger text-xs px-1.5 py-1"
                      title="إعادة ضبط هذا الجيل"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 bg-primary/08 border border-primary/20 rounded-xl p-3">
          <p className="text-xs text-primary/80 font-medium leading-relaxed">
            💡 التغييرات تُحفظ فوراً عند تعديل أي قيمة. اضغط "حفظ الإعدادات" في الأعلى لتأكيد الحفظ النهائي.
          </p>
        </div>
      </div>

      {/* Active overrides summary */}
      {Object.keys(settings.generationOverrides || {}).length > 0 && (
        <div className="settings-section">
          <span className="settings-label">التخصيصات النشطة</span>
          <div className="space-y-2 mt-2">
            {Object.entries(settings.generationOverrides || {}).map(([gen, override]) => {
              const info = GENERATION_INFO.find(g => g.gen === parseInt(gen));
              return (
                <div key={`override-${gen}`} className="info-row">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: override.color }} />
                    <span className="info-label">{info?.label || `جيل ${gen}`}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono">{override.color}</span>
                    <span className="text-xs text-muted-foreground">×{override.scale.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">{override.fontSize}px</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}