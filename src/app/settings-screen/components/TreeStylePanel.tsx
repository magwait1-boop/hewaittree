'use client';
import React from 'react';
import type { AppSettings } from '@/lib/familyData';

interface Props {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

const NODE_SHAPES = [
  { id: 'rect', label: 'مستطيل', desc: 'حواف مدورة قليلاً', svgEl: <rect x="5" y="12" width="40" height="16" rx="3" fill="currentColor" /> },
  { id: 'pill', label: 'كبسولة', desc: 'حواف دائرية كاملة', svgEl: <rect x="5" y="12" width="40" height="16" rx="8" fill="currentColor" /> },
  { id: 'ellipse', label: 'بيضاوي', desc: 'شكل إهليجي', svgEl: <ellipse cx="25" cy="20" rx="20" ry="9" fill="currentColor" /> },
] as const;

const LINE_STYLES = [
  { id: 'curve', label: 'منحني', desc: 'خطوط ناعمة ومنحنية', svgPath: 'M 10 10 C 10 25, 40 25, 40 40' },
  { id: 'straight', label: 'مستقيم', desc: 'خطوط مباشرة بين العقد', svgPath: 'M 10 10 L 40 40' },
  { id: 'step', label: 'متدرج', desc: 'خطوط بزوايا قائمة', svgPath: 'M 10 10 L 10 25 L 40 25 L 40 40' },
] as const;

/** Immediately persist the full settings object to localStorage and notify all listeners */
function persistSettings(updatedSettings: AppSettings) {
  try {
    localStorage.setItem('fam_settings', JSON.stringify(updatedSettings));
    window.dispatchEvent(new CustomEvent('fam_settings_changed', { detail: updatedSettings }));
  } catch {}
}

export default function TreeStylePanel({ settings, onUpdate }: Props) {
  const handleUpdate = (patch: Partial<AppSettings>) => {
    onUpdate(patch);
    // Immediately persist merged settings so FamilyTreeClient reflects changes
    persistSettings({ ...settings, ...patch });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-black text-foreground mb-1">أسلوب الشجرة</h2>
        <p className="text-sm text-muted-foreground">تحكم في أشكال عقد الأشخاص وأسلوب خطوط الربط</p>
      </div>

      {/* Male Node Shape */}
      <div className="settings-section">
        <span className="settings-label">شكل عقدة الذكور</span>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {NODE_SHAPES.map(shape => (
            <button
              key={`male-${shape.id}`}
              onClick={() => handleUpdate({ maleShape: shape.id })}
              className={`shape-option ${settings.maleShape === shape.id ? 'active' : ''}`}
            >
              <svg width="50" height="40" viewBox="0 0 50 40" style={{ color: '#add7a0' }}>
                {shape.svgEl}
              </svg>
              <span className="font-semibold">{shape.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{shape.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Female Node Shape */}
      <div className="settings-section">
        <span className="settings-label">شكل عقدة الإناث</span>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {NODE_SHAPES.map(shape => (
            <button
              key={`female-${shape.id}`}
              onClick={() => handleUpdate({ femaleShape: shape.id })}
              className={`shape-option ${settings.femaleShape === shape.id ? 'active' : ''}`}
            >
              <svg width="50" height="40" viewBox="0 0 50 40" style={{ color: '#fcd9d9' }}>
                {shape.svgEl}
              </svg>
              <span className="font-semibold">{shape.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{shape.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Line Style */}
      <div className="settings-section">
        <span className="settings-label">أسلوب خطوط الربط</span>
        <p className="text-xs text-muted-foreground mb-3">الخطوط التي تصل الأب بأبنائه</p>
        <div className="grid grid-cols-3 gap-3">
          {LINE_STYLES.map(style => (
            <button
              key={`line-${style.id}`}
              onClick={() => handleUpdate({ lineStyle: style.id })}
              className={`shape-option ${settings.lineStyle === style.id ? 'active' : ''}`}
            >
              <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                <path d={style.svgPath} stroke={settings.lineStyle === style.id ? '#10b981' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="10" r="4" fill={settings.lineStyle === style.id ? '#10b981' : '#64748b'} />
                <circle cx="40" cy="40" r="4" fill={settings.lineStyle === style.id ? '#10b981' : '#64748b'} />
              </svg>
              <span className="font-semibold">{style.label}</span>
              <span className="text-xs font-normal text-muted-foreground">{style.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="settings-section">
        <span className="settings-label">ملخص الإعدادات الحالية</span>
        <div className="space-y-2 mt-2">
          {[
            { label: 'شكل الذكور', value: NODE_SHAPES.find(s => s.id === settings.maleShape)?.label || settings.maleShape },
            { label: 'شكل الإناث', value: NODE_SHAPES.find(s => s.id === settings.femaleShape)?.label || settings.femaleShape },
            { label: 'أسلوب الخط', value: LINE_STYLES.find(s => s.id === settings.lineStyle)?.label || settings.lineStyle },
            { label: 'حجم الخط', value: `${settings.baseFontSize}px` },
          ].map(row => (
            <div key={`summary-${row.label}`} className="info-row">
              <span className="info-label">{row.label}</span>
              <span className="info-value text-primary">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}