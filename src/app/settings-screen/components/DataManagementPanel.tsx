'use client';
import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import type { Person } from '@/lib/familyData';

interface Props {
  onReset: () => void;
  onImport?: (data: Person[], merge: boolean) => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  isAdmin?: boolean;
}

export default function DataManagementPanel({ onReset, onImport, onExportCSV, onExportJSON, isAdmin }: Props) {
  const [backupSize, setBackupSize] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkBackup = () => {
    const backup = localStorage.getItem('fam_nodes_backup');
    if (backup) {
      const kb = (new Blob([backup]).size / 1024).toFixed(1);
      setBackupSize(`${kb} KB`);
    } else {
      setBackupSize('لا توجد نسخة احتياطية');
    }
  };

  const clearBackup = () => {
    if (window.confirm('هل تريد حذف النسخة الاحتياطية المحلية؟ ستُحمَّل البيانات من قاعدة البيانات عند التحميل التالي.')) {
      localStorage.removeItem('fam_nodes_backup');
      setBackupSize(null);
      toast.success('تم حذف النسخة الاحتياطية المحلية');
    }
  };

  const clearRequests = () => {
    if (window.confirm('هل تريد حذف جميع الطلبات المعلقة المحلية؟')) {
      localStorage.removeItem('fam_requests');
      toast.success('تم حذف الطلبات المحلية');
    }
  };

  const clearSession = () => {
    localStorage.removeItem('fam_current_user');
    toast.success('تم تسجيل الخروج من الجلسة');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImport) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        let data: Person[] = [];
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text);
        } else {
          const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
          const delim = lines[0].includes(';') ? ';' : ',';
          const rawHeader = lines[0].startsWith('\uFEFF') ? lines[0].slice(1) : lines[0];
          const headers = rawHeader.split(delim).map((h) => h.trim());

          const parseCSVLine = (line: string, sep: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let ci = 0; ci < line.length; ci++) {
              const ch = line[ci];
              if (ch === '"') {
                if (inQuotes && line[ci + 1] === '"') { current += '"'; ci++; }
                else { inQuotes = !inQuotes; }
              } else if (ch === sep && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += ch;
              }
            }
            result.push(current.trim());
            return result;
          };

          const strOrNull = (val: string | undefined): string | undefined => {
            if (val === undefined || val.trim() === '') return undefined;
            return val.trim();
          };
          const parseF = (val: string | undefined): number => {
            if (!val || val.trim() === '') return 0;
            const n = parseFloat(val);
            return isNaN(n) ? 0 : n;
          };
          const parseOptF = (val: string | undefined): number | undefined => {
            if (!val || val.trim() === '') return undefined;
            const n = parseFloat(val);
            return isNaN(n) ? undefined : n;
          };

          data = lines.slice(1).map((line, i) => {
            const cols = parseCSVLine(line, delim);
            const obj: Record<string, string> = {};
            headers.forEach((h, idx) => { obj[h] = cols[idx]?.trim() ?? ''; });
            const rawX = obj.manualX ?? obj.X ?? obj.x ?? '';
            const rawY = obj.manualY ?? obj.Y ?? obj.y ?? '';
            return {
              id: obj.id || `p_import_${Date.now()}_${i}`,
              name: obj.name || obj['الاسم'] || '',
              gender: (obj.gender?.trim() as Person['gender']) || '',
              motherName: strOrNull(obj.motherName),
              fatherId: obj.fatherId?.trim() || '',
              fatherName: strOrNull(obj.fatherName),
              branch: obj.branch?.trim() || '',
              birthDate: strOrNull(obj.birthDate),
              deathDate: strOrNull(obj.deathDate),
              notes: strOrNull(obj.notes),
              leafColor: strOrNull(obj.leafColor),
              edgeColor: strOrNull(obj.edgeColor),
              nodeScale: parseOptF(obj.nodeScale),
              manualX: parseF(rawX),
              manualY: parseF(rawY),
              cardBgColor: strOrNull(obj.cardBgColor),
              cardTextColor: strOrNull(obj.cardTextColor),
              cardWidth: parseOptF(obj.cardWidth),
              cardHeight: parseOptF(obj.cardHeight),
              cardFontSize: parseOptF(obj.cardFontSize),
              cardBorderColor: strOrNull(obj.cardBorderColor),
              cardBorderWidth: parseOptF(obj.cardBorderWidth),
              cardBorderRadius: parseOptF(obj.cardBorderRadius),
            } as Person;
          }).filter((p) => p.name);
        }
        onImport(data, false);
      } catch {
        alert('خطأ في قراءة الملف');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const storageItems = [
    { key: 'fam_nodes_backup', label: 'بيانات الشجرة (نسخة محلية مؤقتة)', icon: '🌳' },
    { key: 'fam_settings', label: 'إعدادات التطبيق', icon: '⚙️' },
    { key: 'fam_requests', label: 'الطلبات المعلقة', icon: '🔔' },
    { key: 'fam_current_user', label: 'جلسة المستخدم الحالية', icon: '👤' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-lg font-black text-foreground mb-1">إدارة البيانات</h2>
        <p className="text-sm text-muted-foreground">
          التخزين المحلي، النسخ الاحتياطي، الاستيراد والتصدير، وإعادة الضبط
        </p>
      </div>

      {/* Supabase Sync Status */}
      <div className="settings-section" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
        <span className="settings-label" style={{ color: '#10b981' }}>🗄 قاعدة البيانات المركزية</span>
        <div className="space-y-2 mt-2">
          <div className="info-row">
            <span className="info-label">المزود</span>
            <span className="info-value text-xs font-mono text-primary">Supabase (PostgreSQL)</span>
          </div>
          <div className="info-row">
            <span className="info-label">الجدول</span>
            <span className="info-value text-xs font-mono">fam_nodes</span>
          </div>
          <div className="info-row">
            <span className="info-label">المزامنة</span>
            <span className="info-value text-xs text-green-400 font-semibold">✓ مفعّلة — جميع الأجهزة ترى نفس البيانات</span>
          </div>
        </div>
      </div>

      {/* Import / Export — Admin only */}
      {isAdmin && (
        <div className="settings-section">
          <span className="settings-label">📂 استيراد وتصدير البيانات</span>
          <p className="text-xs text-muted-foreground mb-3">
            استيراد ملف CSV أو JSON لاستبدال بيانات الشجرة، أو تصدير نسخة احتياطية
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-base justify-center text-sm"
            >
              📂 استيراد CSV / JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button onClick={onExportCSV} className="btn-base justify-center text-sm">
              📎 تصدير CSV
            </button>
            <button onClick={onExportJSON} className="btn-base justify-center text-sm col-span-2 sm:col-span-1">
              📄 تصدير JSON
            </button>
          </div>
        </div>
      )}

      {/* Storage Status */}
      <div className="settings-section">
        <span className="settings-label">التخزين المحلي (ذاكرة تخزين مؤقت)</span>
        <div className="space-y-2 mt-2">
          {storageItems.map(item => {
            const value = typeof window !== 'undefined' ? localStorage.getItem(item.key) : null;
            const hasData = value !== null;
            const size = hasData ? `${(new Blob([value!]).size / 1024).toFixed(1)} KB` : null;
            return (
              <div key={`storage-${item.key}`} className="info-row">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <span className="info-label text-xs">{item.label}</span>
                    <span className="block font-mono text-xs text-muted-foreground/60">{item.key}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasData ? (
                    <>
                      <span className="text-xs text-primary font-semibold">{size}</span>
                      <span className="w-2 h-2 rounded-full bg-primary" />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">فارغ</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backup Actions */}
      <div className="settings-section">
        <span className="settings-label">إجراءات التخزين المحلي</span>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <button onClick={checkBackup} className="btn-base justify-center text-sm">
            🔍 فحص النسخة المحلية
          </button>
          <button onClick={clearBackup} className="btn-base btn-danger justify-center text-sm">
            🗑 حذف النسخة المحلية
          </button>
          <button onClick={clearRequests} className="btn-base justify-center text-sm">
            🗂 مسح الطلبات المعلقة
          </button>
          <button onClick={clearSession} className="btn-base justify-center text-sm">
            🚪 إنهاء الجلسة الحالية
          </button>
        </div>
        {backupSize && (
          <div className="mt-3 glass rounded-lg p-3 text-sm text-foreground/80">
            حجم النسخة المحلية: <span className="font-bold text-primary">{backupSize}</span>
          </div>
        )}
      </div>

      {/* Data Source Info */}
      <div className="settings-section">
        <span className="settings-label">مصدر البيانات</span>
        <div className="space-y-3 mt-2">
          <div className="info-row">
            <span className="info-label">المصدر الأساسي</span>
            <span className="info-value text-xs font-mono text-primary">Supabase — جدول fam_nodes</span>
          </div>
          <div className="info-row">
            <span className="info-label">الـ Fallback</span>
            <span className="info-value text-xs">localStorage — fam_nodes_backup</span>
          </div>
          <div className="info-row">
            <span className="info-label">الطلبات المعلقة</span>
            <span className="info-value text-xs font-mono text-primary">Supabase — جدول fam_requests</span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-section" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
        <span className="settings-label" style={{ color: '#ef4444' }}>منطقة الخطر</span>
        <p className="text-xs text-muted-foreground mb-3">
          هذه الإجراءات لا يمكن التراجع عنها — تأكد قبل المتابعة
        </p>
        <button
          onClick={onReset}
          className="btn-base btn-danger w-full justify-center"
        >
          ⚠ إعادة ضبط جميع الإعدادات للقيم الافتراضية
        </button>
      </div>
    </div>
  );
}