'use client';
import React from 'react';
import type { AppSettings } from '@/lib/familyData';

interface Props {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

const BG_OPTIONS = [
  { id: 'bg-default', label: 'تدرج داكن', desc: 'خلفية متدرجة دائرية من لون الليل', preview: 'bg-default-canvas' },
  { id: 'bg-grid', label: 'شبكة', desc: 'خلفية داكنة مع خطوط شبكية خفيفة', preview: 'bg-grid-canvas' },
  { id: 'bg-dots', label: 'نقاط', desc: 'خلفية داكنة مع نقاط دائرية خفيفة', preview: 'bg-dots-canvas' },
] as const;

export default function AppearancePanel({ settings, onUpdate }: Props) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-black text-foreground mb-1">المظهر العام</h2>
        <p className="text-sm text-muted-foreground">تحكم في خلفية اللوحة وحجم الخط الأساسي</p>
      </div>

      {/* Background Style */}
      <div className="settings-section">
        <span className="settings-label">نمط الخلفية</span>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {BG_OPTIONS.map(opt => (
            <button
              key={`bg-${opt.id}`}
              onClick={() => onUpdate({ bgStyle: opt.id })}
              className={`shape-option text-right ${settings.bgStyle === opt.id ? 'active' : ''}`}
              style={{ alignItems: 'flex-start' }}
            >
              <div className={`w-full h-14 rounded-lg mb-2 ${opt.preview}`} />
              <span className="font-semibold text-xs">{opt.label}</span>
              <span className="text-xs text-muted-foreground font-normal leading-tight">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="settings-section">
        <span className="settings-label">حجم الخط الأساسي</span>
        <p className="text-xs text-muted-foreground mb-3">يؤثر على نصوص جميع العقد في الشجرة</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={8}
            max={40}
            step={1}
            value={settings.baseFontSize}
            onChange={e => onUpdate({ baseFontSize: parseInt(e.target.value) })}
            className="range-input flex-1"
          />
          <div className="glass rounded-lg px-4 py-2 min-w-[60px] text-center">
            <span className="font-black text-primary tabular-nums text-lg">{settings.baseFontSize}</span>
            <span className="text-xs text-muted-foreground block">px</span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>8px — صغير جداً</span>
          <span>40px — كبير جداً</span>
        </div>

        {/* Font preview */}
        <div className="mt-3 glass rounded-xl p-4 text-center">
          <span style={{ fontSize: `${Math.min(settings.baseFontSize * 1.2, 32)}px`, fontWeight: 900, color: '#0f172a', background: '#add7a0', padding: '4px 16px', borderRadius: '8px', display: 'inline-block' }}>
            محمد أحمد حويت
          </span>
          <p className="text-xs text-muted-foreground mt-2">معاينة نص العقدة</p>
        </div>
      </div>

      {/* Color Accents Info */}
      <div className="settings-section">
        <span className="settings-label">ألوان الجنس الافتراضية</span>
        <p className="text-xs text-muted-foreground mb-3">الألوان المستخدمة عند عدم تحديد لون مخصص للعقدة</p>
        <div className="space-y-2">
          {[
            { label: 'الذكور', color: '#add7a0', name: 'أخضر فاتح' },
            { label: 'الإناث', color: '#fcd9d9', name: 'وردي فاتح' },
            { label: 'الجذر (حويت)', color: '#e1d019', name: 'ذهبي' },
            { label: 'غير محدد', color: '#add7a0', name: 'أخضر فاتح (افتراضي)' },
          ].map(item => (
            <div key={`color-${item.label}`} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-white/20" style={{ background: item.color }} />
              <div>
                <span className="text-sm font-semibold text-foreground">{item.label}</span>
                <span className="text-xs text-muted-foreground mr-2">{item.name}</span>
              </div>
              <span className="mr-auto font-mono text-xs text-muted-foreground">{item.color}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-warning mt-3">
          💡 لتغيير لون شخص بعينه، افتح بطاقته واختر لوناً مخصصاً من نموذج التعديل
        </p>
      </div>
    </div>
  );
}