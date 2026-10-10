'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { DEFAULT_SETTINGS, LOCAL_SETTINGS_PENDING_KEY, type AppSettings, type Person } from '@/lib/familyData';
import { fetchSettings, saveSettings, fetchAllPersons, replaceAllPersons } from '@/lib/famNodeService';
import { createClient } from '@/lib/supabase/client';
import { normalizeSettings } from '@/lib/familyData';
import { Toaster, toast } from 'sonner';
import AppearancePanel from './AppearancePanel';
import TreeStylePanel from './TreeStylePanel';
import GenerationColorsPanel from './GenerationColorsPanel';
import DataManagementPanel from './DataManagementPanel';
import SupervisorsPanel from './SupervisorsPanel';

export type SettingsTab = 'appearance' | 'tree-style' | 'generation-colors' | 'data' | 'supervisors';

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string; desc: string }[] = [
  { id: 'appearance', label: 'المظهر العام', icon: '🎨', desc: 'الخلفية، الألوان، الخط' },
  { id: 'tree-style', label: 'أسلوب الشجرة', icon: '🌳', desc: 'أشكال العقد، خطوط الربط' },
  { id: 'generation-colors', label: 'ألوان الأجيال', icon: '🎭', desc: 'تخصيص كل جيل على حدة' },
  { id: 'data', label: 'إدارة البيانات', icon: '💾', desc: 'نسخ احتياطي، استيراد، تصدير' },
  { id: 'supervisors', label: 'إدارة المشرفين', icon: '👥', desc: 'إضافة مشرفين وحذف حساباتهم' },
];

export default function SettingsClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [persons, setPersons] = useState<Person[]>([]);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);

  // Keep pending local edits visible when returning to the settings screen.
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const local = localStorage.getItem('fam_settings');
        if (localStorage.getItem(LOCAL_SETTINGS_PENDING_KEY) === '1' && local) {
          setSettings(normalizeSettings(JSON.parse(local)));
          setHasChanges(true);
          return;
        }
        const remoteSettings = await fetchSettings();
        if (remoteSettings) {
          const merged = normalizeSettings(remoteSettings);
          setSettings(merged);
          localStorage.setItem('fam_settings', JSON.stringify(merged));
        } else {
          const saved = localStorage.getItem('fam_settings');
          if (saved) {
            try { setSettings(normalizeSettings(JSON.parse(saved))); } catch {}
          }
        }
      } catch {
        const saved = localStorage.getItem('fam_settings');
        if (saved) {
          try { setSettings(normalizeSettings(JSON.parse(saved))); } catch {}
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();

    // Load current user for admin check
    const savedUser = localStorage.getItem('fam_current_user');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch {}
    }

    // Load persons for export
    fetchAllPersons().then(p => { if (p) setPersons(p); });
  }, []);

  // ── Realtime subscription for app_settings ────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('realtime:app_settings:settings-screen')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        async () => {
          if (localStorage.getItem(LOCAL_SETTINGS_PENDING_KEY) === '1') return;
          const remoteSettings = await fetchSettings();
          if (remoteSettings) {
            const merged = normalizeSettings(remoteSettings);
            setSettings(merged);
            setHasChanges(false);
            localStorage.setItem('fam_settings', JSON.stringify(merged));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const settingsJson = JSON.stringify(settings);
      const ok = await saveSettings(settings as unknown as Record<string, unknown>);
      localStorage.setItem('fam_settings', settingsJson);
      if (ok) localStorage.removeItem(LOCAL_SETTINGS_PENDING_KEY);
      window.dispatchEvent(new CustomEvent('fam_settings_changed', { detail: settings }));
      setSaveStatus('saved');
      setHasChanges(false);
      if (ok) {
        toast.success('تم حفظ جميع الإعدادات بنجاح — مزامنة مع جميع الأجهزة');
      } else {
        toast.warning('تم الحفظ محلياً فقط — تعذّر المزامنة مع قاعدة البيانات');
      }
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
      toast.error('خطأ في حفظ الإعدادات');
    }
  }, [settings]);

  const handleReset = useCallback(async () => {
    if (window.confirm('هل تريد إعادة ضبط جميع الإعدادات للقيم الافتراضية؟')) {
      setSettings(DEFAULT_SETTINGS);
      const defaultJson = JSON.stringify(DEFAULT_SETTINGS);
      await saveSettings(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
      localStorage.setItem('fam_settings', defaultJson);
      localStorage.removeItem(LOCAL_SETTINGS_PENDING_KEY);
      window.dispatchEvent(new CustomEvent('fam_settings_changed', { detail: DEFAULT_SETTINGS }));
      setHasChanges(false);
      toast.success('تم إعادة ضبط الإعدادات');
    }
  }, []);

  const handleImport = useCallback(async (data: Person[], _merge: boolean) => {
    const total = data.length;
    const toastId = toast.loading(`جارٍ استيراد ${total.toLocaleString('ar-EG')} شخص...`);
    const ok = await replaceAllPersons(data);
    toast.dismiss(toastId);
    if (ok) {
      setPersons(data);
      toast.success(`✅ تم استيراد ${total.toLocaleString('ar-EG')} شخص`);
    } else {
      toast.error('تعذّر الاستيراد — تحقق من الاتصال');
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    const headers = 'id,name,gender,fatherId,branch,birthDate,deathDate,notes,leafColor,nodeScale,manualX,manualY';
    const rows = persons.map(p =>
      [p.id, p.name, p.gender, p.fatherId, p.branch, p.birthDate || '', p.deathDate || '',
       p.notes || '', p.leafColor || '', p.nodeScale || 1, p.manualX, p.manualY].join(',')
    );
    const csv = '\uFEFF' + headers + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'family_tree.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير CSV');
  }, [persons]);

  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(persons, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'family_tree.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير JSON');
  }, [persons]);

  return (
    <div
      className="min-h-screen bg-default-canvas flex flex-col overflow-y-auto"
      style={{ direction: 'rtl', fontFamily: 'var(--font-sans)', overflowY: 'auto', height: '100vh' }}
    >
      {/* Top bar */}
      <header className="glass-panel flex flex-wrap items-center gap-2 px-3 py-3 sm:h-14 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-0 flex-shrink-0 z-10 sticky top-0">
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="btn-base text-sm"
            aria-label="العودة للشجرة"
          >
            ← العودة للشجرة
          </button>
          <div className="flex items-center gap-2 mr-2">
            <AppLogo size={28} />
            <span className="font-black text-sm text-foreground hidden sm:block">إعدادات الشجرة</span>
          </div>
        </div>
        <div className="mr-auto flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto sm:gap-3">
          {isLoading && (
            <span className="mr-auto text-xs text-muted-foreground animate-pulse">جارٍ التحميل...</span>
          )}
          {hasChanges && !isLoading && (
            <span className="mr-auto text-xs text-warning font-semibold animate-pulse">
              ● تغييرات غير محفوظة
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="mr-auto text-xs text-primary font-semibold">✓ تم الحفظ</span>
          )}
          <button onClick={handleReset} className="btn-base btn-danger text-xs">
            إعادة ضبط
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving' || isLoading}
            className="btn-base btn-primary text-sm px-5"
          >
            {saveStatus === 'saving' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                حفظ...
              </span>
            ) : '💾 حفظ الإعدادات'}
          </button>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col md:flex-row" style={{ minHeight: 0 }}>
        {/* Left Nav */}
        <nav aria-label="أقسام الإعدادات" className="w-full min-w-0 flex-shrink-0 glass-sidebar p-3 md:w-64 md:p-4 md:overflow-y-auto scrollbar-thin md:sticky md:top-14 md:self-start md:max-h-[calc(100vh-3.5rem)]">
          <p className="settings-label px-2 mb-3 hidden md:block">الأقسام</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin md:block md:space-y-1">
            {NAV_ITEMS.filter(item => item.id !== 'supervisors' || currentUser?.role === 'admin').map(item => (
              <button
                key={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? 'page' : undefined}
                className={`nav-item-settings w-auto flex-shrink-0 text-right md:w-full ${activeTab === item.id ? 'active' : ''}`}
              >
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{item.label}</div>
                  <div className="hidden md:block text-xs text-muted-foreground truncate">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Live preview mini */}
          <div className="hidden md:block mt-6 pt-4 border-t border-white/10">
            <p className="settings-label px-2 mb-3">معاينة مصغرة</p>
            <div
              className={`rounded-xl overflow-hidden h-24 flex items-center justify-center relative ${
                settings.bgStyle === 'bg-grid' ? 'bg-grid-canvas' :
                settings.bgStyle === 'bg-dots' ? 'bg-dots-canvas' : 'bg-default-canvas'
              }`}
            >
              <svg width="120" height="70" viewBox="0 0 120 70" style={{ direction: 'ltr' }}>
                {/* Root */}
                {settings.maleShape === 'ellipse' ? (
                  <ellipse cx="60" cy="15" rx="20" ry="10" fill="#e1d019" />
                ) : settings.maleShape === 'pill' ? (
                  <rect x="40" y="8" width="40" height="14" rx="7" fill="#e1d019" />
                ) : (
                  <rect x="40" y="8" width="40" height="14" rx="3" fill="#e1d019" />
                )}
                <text x="60" y="16" textAnchor="middle" dominantBaseline="central" fontSize="6" fontWeight="900" fill="#0f172a" fontFamily="Tajawal">حويت</text>

                {/* Edges */}
                {settings.lineStyle === 'straight' ? (
                  <><line x1="60" y1="22" x2="30" y2="42" stroke="#ddb892" strokeWidth="1" /><line x1="60" y1="22" x2="90" y2="42" stroke="#db0677" strokeWidth="1" /></>
                ) : settings.lineStyle === 'step' ? (
                  <><path d="M 60 22 L 60 32 L 30 32 L 30 42" stroke="#ddb892" strokeWidth="1" fill="none" /><path d="M 60 22 L 60 32 L 90 32 L 90 42" stroke="#db0677" strokeWidth="1" fill="none" /></>
                ) : (
                  <><path d="M 60 22 C 60 32, 30 32, 30 42" stroke="#ddb892" strokeWidth="1" fill="none" /><path d="M 60 22 C 60 32, 90 32, 90 42" stroke="#db0677" strokeWidth="1" fill="none" /></>
                )}

                {/* Children */}
                {settings.maleShape === 'ellipse' ? (
                  <ellipse cx="30" cy="52" rx="16" ry="9" fill="#add7a0" />
                ) : settings.maleShape === 'pill' ? (
                  <rect x="14" y="45" width="32" height="14" rx="7" fill="#add7a0" />
                ) : (
                  <rect x="14" y="45" width="32" height="14" rx="3" fill="#add7a0" />
                )}
                {settings.femaleShape === 'ellipse' ? (
                  <ellipse cx="90" cy="52" rx="16" ry="9" fill="#fcd9d9" />
                ) : settings.femaleShape === 'pill' ? (
                  <rect x="74" y="45" width="32" height="14" rx="7" fill="#fcd9d9" />
                ) : (
                  <rect x="74" y="45" width="32" height="14" rx="3" fill="#fcd9d9" />
                )}
              </svg>
            </div>
          </div>
        </nav>

        {/* Right Content — scrollable with proper bottom padding */}
        <main className="min-w-0 flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-6 pb-32" style={{ overflowY: 'auto' }}>
          <div className="max-w-2xl min-w-0 mx-auto">
            {activeTab === 'appearance' && (
              <AppearancePanel settings={settings} onUpdate={updateSettings} />
            )}
            {activeTab === 'tree-style' && (
              <TreeStylePanel settings={settings} onUpdate={updateSettings} />
            )}
            {activeTab === 'generation-colors' && (
              <GenerationColorsPanel settings={settings} onUpdate={updateSettings} />
            )}
            {activeTab === 'data' && (
              <DataManagementPanel
                onReset={handleReset}
                onImport={handleImport}
                onExportCSV={handleExportCSV}
                onExportJSON={handleExportJSON}
                isAdmin={currentUser?.role === 'admin'}
              />
            )}
            {activeTab === 'supervisors' && currentUser?.role === 'admin' && (
              <SupervisorsPanel />
            )}
          </div>
        </main>
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 px-6 py-3 flex items-center justify-between z-30 animate-slide-up">
          <span className="text-sm font-semibold text-warning">
            ⚠ لديك تغييرات غير محفوظة
          </span>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                const remoteSettings = await fetchSettings();
                if (remoteSettings) {
                  const restored = normalizeSettings(remoteSettings);
                  setSettings(restored);
                  localStorage.setItem('fam_settings', JSON.stringify(restored));
                } else {
                  const saved = localStorage.getItem('fam_settings');
                  if (saved) { try { setSettings(JSON.parse(saved)); } catch {} }
                }
                localStorage.removeItem(LOCAL_SETTINGS_PENDING_KEY);
                setHasChanges(false);
              }}
              className="btn-base text-sm"
            >
              تجاهل التغييرات
            </button>
            <button onClick={handleSave} className="btn-base btn-primary text-sm px-5">
              حفظ الآن
            </button>
          </div>
        </div>
      )}

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(15,23,42,0.98)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#e2e8f0',
            fontFamily: 'Tajawal, sans-serif',
            direction: 'rtl',
          },
        }}
      />
    </div>
  );
}
