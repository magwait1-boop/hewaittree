'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MOCK_PERSONS, DEFAULT_SETTINGS, SYSTEM_USERS, buildChildrenMap, buildPersonMap, buildNameIndex, searchPersons, normalizeSettings, type Person, type PendingRequest, type AppSettings,  } from '@/lib/familyData';
import {
  fetchAllPersons,
  upsertPerson,
  deletePerson as deletePersonFromDB,
  mergePersons,
  replaceAllPersons,
  updatePersonPosition,
  fetchSettings,
  fromRowPublic,
} from '@/lib/famNodeService';
import {
  fetchPendingRequests,
  insertRequest,
  updateRequestStatus,
} from '@/lib/famRequestService';

import TreeToolbar from './TreeToolbar';
import TreeSidebar from './TreeSidebar';
import ZoomControls from './ZoomControls';
import NodeModal from './NodeModal';
import AdminModal from './AdminModal';
import AuthModal from './AuthModal';
import TreeHeader from './TreeHeader';
import { Toaster, toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const TreeCanvas = dynamic(() => import('./TreeCanvas'), { ssr: false });

export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

export interface CurrentUser {
  username: string;
  role: 'admin' | 'supervisor';
}

export default function FamilyTreeClient() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 0.18 });
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sidebarNodeId, setSidebarNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [nodeModalParentId, setNodeModalParentId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  const personMapRef = useRef<Map<string, Person>>(new Map());
  const childrenMapRef = useRef<Map<string, string[]>>(new Map());
  const nameIndexRef = useRef<Map<string, string[]>>(new Map());
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFitDone = useRef(false);
  // إضافة المؤشر لحماية السحب من تداخل السيرفر
  const isDraggingActiveRef = useRef(false);

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to fam_nodes changes
    const nodesChannel = supabase
      .channel('realtime:fam_nodes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fam_nodes' },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          // منع السيرفر من التدخل وإعادة رسم البطاقة أثناء قيامك بسحبها يدوياً
          if (isDraggingActiveRef.current) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            let updated = fromRowPublic(payload.new);
            setPersons(prev => {
              const idx = prev.findIndex(p => p.id === updated.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
              }
              return [...prev, updated];
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string }).id;
            if (deletedId) {
              setPersons(prev =>
                prev
                  .filter(p => p.id !== deletedId)
                  .map(p => p.fatherId === deletedId ? { ...p, fatherId: '' } : p)
              );
            }
          }
        }
      )
      .subscribe();

    // Subscribe to app_settings changes
    const settingsChannel = supabase
      .channel('realtime:app_settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        async () => {
          const remoteSettings = await fetchSettings();
          if (remoteSettings) {
            const merged = normalizeSettings(remoteSettings);
            setSettings(merged);
            localStorage.setItem('fam_settings', JSON.stringify(merged));
          }
        }
      )
      .subscribe();

    // Subscribe to fam_requests changes (real-time for admin)
    const requestsChannel = supabase
      .channel('realtime:fam_requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fam_requests' },
        async () => {
          const requests = await fetchPendingRequests();
          setPendingRequests(requests);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(nodesChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, []);

  // ── Load data from Supabase on mount ──────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setIsLoadingData(true);
      try {
        const [remotePersons, remoteSettings, remoteRequests] = await Promise.all([
          fetchAllPersons(),
          fetchSettings(),
          fetchPendingRequests(),
        ]);

        // ── Persons ──
        if (remotePersons && remotePersons.length > 0) {
          setPersons(remotePersons);
          localStorage.setItem('fam_nodes_backup', JSON.stringify(remotePersons));
        } else if (remotePersons && remotePersons.length === 0) {
          const backup = localStorage.getItem('fam_nodes_backup');
          const loaded: Person[] = backup ? JSON.parse(backup) : MOCK_PERSONS;
          setPersons(loaded);
        } else {
          const backup = localStorage.getItem('fam_nodes_backup');
          const loaded: Person[] = backup ? JSON.parse(backup) : MOCK_PERSONS;
          setPersons(loaded);
          toast.error('تعذّر الاتصال بقاعدة البيانات — يُعرض آخر نسخة محلية');
        }

        // ── Settings ──
        if (remoteSettings) {
          const merged = normalizeSettings(remoteSettings);
          setSettings(merged);
          localStorage.setItem('fam_settings', JSON.stringify(merged));
        } else {
          const savedSettings = localStorage.getItem('fam_settings');
          if (savedSettings) {
            try { setSettings(normalizeSettings(JSON.parse(savedSettings))); } catch {}
          }
        }

        // ── Pending Requests (from Supabase, not localStorage) ──
        setPendingRequests(remoteRequests);

      } catch {
        const backup = localStorage.getItem('fam_nodes_backup');
        const loaded: Person[] = backup ? JSON.parse(backup) : MOCK_PERSONS;
        setPersons(loaded);
        const savedSettings = localStorage.getItem('fam_settings');
        if (savedSettings) {
          try { setSettings(normalizeSettings(JSON.parse(savedSettings))); } catch {}
        }
        toast.error('خطأ في تحميل البيانات — يُعرض آخر نسخة محلية');
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();

    const savedUser = localStorage.getItem('fam_current_user');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch {}
    }
  }, []);

  // Re-apply settings whenever the page becomes visible again
  useEffect(() => {
    const reloadSettingsFromDB = async () => {
      const remoteSettings = await fetchSettings();
      if (remoteSettings) {
        const merged = normalizeSettings(remoteSettings);
        setSettings(merged);
        localStorage.setItem('fam_settings', JSON.stringify(merged));
      } else {
        const savedSettings = localStorage.getItem('fam_settings');
        if (savedSettings) {
          try { setSettings(normalizeSettings(JSON.parse(savedSettings))); } catch {}
        }
      }
    };

    const reloadPersonsFromDB = async () => {
      const remotePersons = await fetchAllPersons();
      if (remotePersons && remotePersons.length > 0) {
        setPersons(remotePersons);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(remotePersons));
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'fam_settings' && e.newValue) {
        try { setSettings(normalizeSettings(JSON.parse(e.newValue))); } catch {}
      }
    };

    const handleCustomSettingsChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        try { setSettings(typeof detail === 'string' ? normalizeSettings(JSON.parse(detail)) : normalizeSettings(detail as Record<string, unknown>)); } catch {}
      } else {
        reloadSettingsFromDB();
      }
    };

    const handleFocus = () => {
      reloadSettingsFromDB();
      reloadPersonsFromDB();
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('fam_settings_changed', handleCustomSettingsChange);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        reloadSettingsFromDB();
        reloadPersonsFromDB();
      }
    });

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('fam_settings_changed', handleCustomSettingsChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Rebuild indexes when persons change
  useEffect(() => {
    personMapRef.current = buildPersonMap(persons);
    childrenMapRef.current = buildChildrenMap(persons);
    nameIndexRef.current = buildNameIndex(persons);
  }, [persons]);

  // Fit to view on initial load
  useEffect(() => {
    if (persons.length === 0 || initialFitDone.current) return;
    initialFitDone.current = true;
    const xs = persons.map(p => p.manualX);
    const ys = persons.map(p => p.manualY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const H = typeof window !== 'undefined' ? window.innerHeight - 120 : 800;
    const scaleX = (W - 100) / (maxX - minX || 1);
    const scaleY = (H - 100) / (maxY - minY || 1);
    const s = Math.min(scaleX, scaleY, 0.5);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    setView({ x: W / 2 - midX * s, y: H / 2 - midY * s, scale: s });
  }, [persons]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchMatches([]);
      setSearchIndex(0);
      return;
    }
    const matches = searchPersons(query, persons, nameIndexRef.current);
    setSearchMatches(matches);
    setSearchIndex(0);
    if (matches.length > 0) {
      centerOnNode(matches[0]);
      setSidebarNodeId(matches[0]);
      setIsSidebarOpen(true);
    } else {
      toast.error('لا توجد نتائج للبحث');
    }
  }, [persons]);

  const centerOnNode = useCallback((id: string) => {
    const p = personMapRef.current.get(id);
    if (!p) return;
    const W = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const H = typeof window !== 'undefined' ? window.innerHeight - 120 : 800;
    const s = 1.3;
    setView({ x: W / 2 - p.manualX * s, y: H / 2 - p.manualY * s, scale: s });
  }, []);

  const navigateSearch = useCallback((dir: 'prev' | 'next') => {
    if (searchMatches.length === 0) return;
    const newIdx = dir === 'next'
      ? (searchIndex + 1) % searchMatches.length
      : (searchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchIndex(newIdx);
    centerOnNode(searchMatches[newIdx]);
    setSidebarNodeId(searchMatches[newIdx]);
    setIsSidebarOpen(true);
  }, [searchMatches, searchIndex, centerOnNode]);

  const handleNodeClick = useCallback((id: string) => {
    setSidebarNodeId(id);
    setIsSidebarOpen(true);
  }, []);

  const handleNodeDblClick = useCallback((id: string) => {
    if (!currentUser) return;
    const p = personMapRef.current.get(id);
    if (!p) return;
    setEditingPerson(p);
    setNodeModalParentId('');
    setShowNodeModal(true);
  }, [currentUser]);

  const handleZoom = useCallback((factor: number) => {
    setView(v => ({ ...v, scale: Math.max(0.05, Math.min(3, v.scale * factor)) }));
  }, []);

  const handleFitToView = useCallback(() => {
    if (persons.length === 0) return;
    const xs = persons.map(p => p.manualX);
    const ys = persons.map(p => p.manualY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const H = typeof window !== 'undefined' ? window.innerHeight - 120 : 800;
    const s = Math.min((W - 100) / (maxX - minX || 1), (H - 100) / (maxY - minY || 1), 0.5);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    setView({ x: W / 2 - midX * s, y: H / 2 - midY * s, scale: s });
  }, [persons]);

  const handleLogin = useCallback((username: string, password: string): boolean => {
    const user = SYSTEM_USERS[username];
    if (user && user.pass === password) {
      const u: CurrentUser = { username, role: user.role };
      setCurrentUser(u);
      localStorage.setItem('fam_current_user', JSON.stringify(u));
      toast.success(`مرحباً ${username} — صلاحية: ${user.role === 'admin' ? 'مسؤول' : 'مشرف'}`);
      return true;
    }
    return false;
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('fam_current_user');
    toast.success('تم تسجيل الخروج');
  }, []);

  const handleSavePerson = useCallback(async (data: Person) => {
    if (currentUser?.role === 'admin') {
      // Optimistic UI update immediately
      setPersons(prev => {
        const idx = prev.findIndex(p => p.id === data.id);
        let updated: Person[];
        if (idx >= 0) {
          updated = [...prev];
          updated[idx] = data;
        } else {
          updated = [...prev, data];
        }
        localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
        window.dispatchEvent(new Event('fam_nodes_changed'));
        return updated;
      });

      // Persist to Supabase directly
      let ok = await upsertPerson(data);
      if (!ok) {
        toast.error('تحذير: تم الحفظ محلياً فقط — تعذّر الحفظ في قاعدة البيانات');
      } else {
        toast.success(data.id ? 'تم حفظ البيانات بنجاح ✓' : 'تمت إضافة الشخص بنجاح ✓');
      }
    } else if (currentUser?.role === 'supervisor') {
      const req: PendingRequest = {
        reqId: `req_${Date.now()}`,
        type: data.id ? 'edit' : 'add',
        data,
        by: currentUser.username,
        createdAt: new Date().toLocaleDateString('ar-EG'),
      };
      // Save to Supabase so admin sees it in real-time
      let ok = await insertRequest(req);
      if (ok) {
        toast.success('تم إرسال الطلب للمسؤول للمراجعة');
      } else {
        // Fallback to local state if Supabase fails
        setPendingRequests(prev => [...prev, req]);
        toast.warning('تم حفظ الطلب محلياً — تعذّر الإرسال للمسؤول');
      }
    }
    setShowNodeModal(false);
    setEditingPerson(null);
  }, [currentUser]);

  const handleDeletePerson = useCallback(async (id: string) => {
    if (currentUser?.role === 'admin') {
      setPersons(prev => {
        let updated = prev
          .filter(p => p.id !== id)
          .map(p => p.fatherId === id ? { ...p, fatherId: '' } : p);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
        window.dispatchEvent(new Event('fam_nodes_changed'));
        return updated;
      });
      setSidebarNodeId(null);
      setIsSidebarOpen(false);

      let ok = await deletePersonFromDB(id);
      if (!ok) {
        toast.error('تحذير: تم الحذف محلياً فقط — تعذّر الحذف من قاعدة البيانات');
      } else {
        toast.success('تم حذف الشخص');
      }
    } else if (currentUser?.role === 'supervisor') {
      const req: PendingRequest = {
        reqId: `req_${Date.now()}`,
        type: 'delete',
        targetId: id,
        by: currentUser.username,
        createdAt: new Date().toLocaleDateString('ar-EG'),
      };
      let ok = await insertRequest(req);
      if (ok) {
        toast.success('تم إرسال طلب الحذف للمسؤول');
      } else {
        setPendingRequests(prev => [...prev, req]);
        toast.warning('تم حفظ طلب الحذف محلياً — تعذّر الإرسال للمسؤول');
      }
    }
  }, [currentUser]);

  const handleApproveRequest = useCallback(async (reqId: string) => {
    const req = pendingRequests.find(r => r.reqId === reqId);
    if (!req) return;
    if (req.type === 'add' || req.type === 'edit') {
      if (req.data) {
        setPersons(prev => {
          const idx = prev.findIndex(p => p.id === req.data!.id);
          let updated: Person[];
          if (idx >= 0) {
            updated = [...prev]; updated[idx] = req.data!;
          } else {
            updated = [...prev, req.data!];
          }
          localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
          window.dispatchEvent(new Event('fam_nodes_changed'));
          return updated;
        });
        await upsertPerson(req.data);
      }
    } else if (req.type === 'delete' && req.targetId) {
      setPersons(prev => {
        let updated = prev
          .filter(p => p.id !== req.targetId)
          .map(p => p.fatherId === req.targetId ? { ...p, fatherId: '' } : p);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
        window.dispatchEvent(new Event('fam_nodes_changed'));
        return updated;
      });
      await deletePersonFromDB(req.targetId);
    }
    // Update status in Supabase and remove from local state
    await updateRequestStatus(reqId, 'approved');
    setPendingRequests(prev => prev.filter(r => r.reqId !== reqId));
    toast.success('تم اعتماد الطلب');
  }, [pendingRequests]);

  const handleRejectRequest = useCallback(async (reqId: string) => {
    await updateRequestStatus(reqId, 'rejected');
    setPendingRequests(prev => prev.filter(r => r.reqId !== reqId));
    toast.error('تم رفض الطلب');
  }, []);

  const handleNodeDrag = useCallback((id: string, dx: number, dy: number) => {
    // التأكد إن المستخدم أدمن
    if (currentUser?.role !== 'admin') return;

    // 1. تشغيل حماية السحب (عشان السيرفر ما يتدخلش ويرجع الكارت مكانه)
    isDraggingActiveRef.current = true;

    setPersons(prev => {
      let updated = prev.map(p => {
        if (selectedIds.has(p.id) || p.id === id) {
          return {
            ...p,
            // 2. استخدام Number للحماية من خطأ النصوص (NaN) مع إضافة الإحداثيات بسلاسة
            manualX: (Number(p.manualX) || 0) + dx,
            manualY: (Number(p.manualY) || 0) + dy,
          };
        }
        return p;
      });

      // حفظ نسخة احتياطية محلية
      localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));

      // 3. تأخير الحفظ في الداتا بيز لحد ما ترفع إيدك من على الماوس
      if (dragSaveTimer.current) clearTimeout(dragSaveTimer.current);
      dragSaveTimer.current = setTimeout(async () => {
        const movedIds = selectedIds.has(id) ? [...selectedIds] : [id];
        const updatedMap = buildPersonMap(updated);
        
        for (const pid of movedIds) {
          const p = updatedMap.get(pid);
          if (p) {
            // حفظ الرقم كقيمة صحيحة (بدون كسور) في قاعدة البيانات
            await updatePersonPosition(p.id, Math.round(Number(p.manualX) || 0), Math.round(Number(p.manualY) || 0));
          }
        }
        
        // 4. إيقاف حماية السحب بعد اكتمال الحفظ بنجاح
        isDraggingActiveRef.current = false;
      }, 500);

      return updated;
    });
  }, [currentUser, selectedIds]);

  const handleImport = useCallback(async (data: Person[], merge: boolean) => {
    const total = data.length;
    const toastId = toast.loading(`جارٍ استيراد ${total.toLocaleString('ar-EG')} شخص — الدُفعة 1...`);

    const totalBatches = Math.ceil(total / 200);
    let ok: boolean;

    const onProgress = (done: number, _total: number) => {
      const batchNum = Math.ceil(done / 200);
      toast.loading(
        `جارٍ الاستيراد — الدُفعة ${batchNum}/${totalBatches} (${done.toLocaleString('ar-EG')} / ${_total.toLocaleString('ar-EG')})...`,
        { id: toastId }
      );
    };

    if (merge) {
      ok = await mergePersons(data, onProgress);
    } else {
      ok = await replaceAllPersons(data, onProgress);
    }

    toast.dismiss(toastId);

    if (ok) {
      toast.loading('جارٍ التحقق من البيانات المستوردة...', { id: 'import-verify' });
      const freshPersons = await fetchAllPersons();
      toast.dismiss('import-verify');
      if (freshPersons && freshPersons.length > 0) {
        setPersons(freshPersons);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(freshPersons));
        toast.success(`✅ تم استيراد وتحقق ${freshPersons.length.toLocaleString('ar-EG')} شخص — مزامنة مع جميع الأجهزة`);
      } else {
        if (merge) {
          setPersons(prev => {
            let updated = [...prev, ...data];
            localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
            return updated;
          });
        } else {
          setPersons(data);
          localStorage.setItem('fam_nodes_backup', JSON.stringify(data));
        }
        toast.success(`✅ تم استيراد ${total.toLocaleString('ar-EG')} شخص وحفظهم في قاعدة البيانات`);
      }
    } else {
      if (merge) {
        setPersons(prev => {
          let updated = [...prev, ...data];
          localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
          return updated;
        });
      } else {
        setPersons(data);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(data));
      }
      toast.error(`تم الاستيراد محلياً (${total.toLocaleString('ar-EG')} شخص) — تعذّر الحفظ في قاعدة البيانات`);
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

  const handlePrint = useCallback(() => {
    setIsPrinting(true);
  }, []);

  const openAddPerson = useCallback((parentId = '') => {
    setEditingPerson(null);
    setNodeModalParentId(parentId);
    setShowNodeModal(true);
  }, []);

  const handleSelectDescendants = useCallback((id: string) => {
    const collect = (nodeId: string, acc: Set<string>) => {
      acc.add(nodeId);
      const children = childrenMapRef.current.get(nodeId) ?? [];
      for (const childId of children) collect(childId, acc);
    };
    const ids = new Set<string>();
    collect(id, ids);
    setSelectedIds(ids);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ direction: 'rtl' }}>
      {/* Background canvas style */}
      <div className={`absolute inset-0 ${
        settings.bgStyle === 'bg-grid' ? 'bg-grid-canvas' :
        settings.bgStyle === 'bg-dots' ? 'bg-dots-canvas' : 'bg-default-canvas'
      }`} />

      {/* Loading overlay */}
      {isLoadingData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm font-semibold text-foreground">جارٍ تحميل بيانات الشجرة...</span>
          </div>
        </div>
      )}
           {/* Top Header with Logo, Title, and Search Bar */}
      <TreeHeader
        currentUser={currentUser}
        searchQuery={searchQuery}
        searchMatches={searchMatches}
        searchIndex={searchIndex}
        totalPersons={persons.length}
        onSearch={handleSearch}
        onNavigateSearch={navigateSearch}
        onLoginClick={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onPrint={handlePrint}
      />

      {/* Toolbar */}
      <TreeToolbar
        persons={persons}
        currentUser={currentUser}
        pendingCount={pendingRequests.length}
        onAddPerson={() => openAddPerson()}
        onOpenAdmin={() => setShowAdminModal(true)}
        onImport={handleImport}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onOpenSettings={() => window.location.href = '/settings-screen'}
        onPrint={handlePrint}
      />

      {/* Tree Canvas */}
      <div className="absolute inset-0 pt-[112px] tree-canvas-wrap">
        <TreeCanvas
          persons={persons}
          view={view}
          setView={setView}
          settings={settings}
          searchMatches={searchMatches}
          selectedIds={selectedIds}
          sidebarNodeId={sidebarNodeId}
          onNodeClick={handleNodeClick}
          onNodeDblClick={handleNodeDblClick}
          onNodeDrag={handleNodeDrag}
          canDrag={currentUser?.role === 'admin'}
          personMap={personMapRef.current}
          childrenMap={childrenMapRef.current}
          onBgClick={() => {
            setSelectedIds(new Set());
            setSidebarNodeId(null);
            setIsSidebarOpen(false);
          }}
          isPrinting={isPrinting}
          onPrintDone={() => setIsPrinting(false)}
        />
      </div>

      {/* Sidebar */}
      <div className={`sidebar-wrap ${isSidebarOpen && sidebarNodeId ? 'open' : ''}`}>
        <TreeSidebar
          nodeId={sidebarNodeId}
          persons={persons}
          personMap={personMapRef.current}
          childrenMap={childrenMapRef.current}
          currentUser={currentUser}
          onClose={() => { setIsSidebarOpen(false); setSidebarNodeId(null); }}
          onEdit={(id) => {
            const p = personMapRef.current.get(id);
            if (p) { setEditingPerson(p); setShowNodeModal(true); }
          }}
          onAddChild={(parentId) => openAddPerson(parentId)}
          onDelete={handleDeletePerson}
          onSelectDescendants={handleSelectDescendants}
          onCenterNode={centerOnNode}
        />
      </div>

      {/* Zoom Controls */}
      <ZoomControls onZoomIn={() => handleZoom(1.2)} onZoomOut={() => handleZoom(0.8)} onFit={handleFitToView} />

      {/* Modals */}
      {showAuthModal && (
        <AuthModal
          onLogin={handleLogin}
          onClose={() => setShowAuthModal(false)}
        />
      )}
      {showNodeModal && (
        <NodeModal
          editing={editingPerson}
          parentId={nodeModalParentId}
          persons={persons}
          currentUser={currentUser}
          personMap={personMapRef.current}
          onSave={handleSavePerson}
          onClose={() => { setShowNodeModal(false); setEditingPerson(null); }}
        />
      )}
      {showAdminModal && currentUser?.role === 'admin' && (
        <AdminModal
          requests={pendingRequests}
          personMap={personMapRef.current}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          onClose={() => setShowAdminModal(false)}
        />
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

      {/* نافذة الـ Plot بنظام الأوتوكاد الكامل */}
      {isPrinting && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/95 backdrop-blur border-2 border-emerald-500/80 p-5 rounded-2xl shadow-2xl flex flex-col gap-4 dir-rtl min-w-[380px] text-white">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <h3 className="font-bold text-base flex items-center gap-2">
              <span>🖨️</span> إعدادات الطباعة (Plot Model)
            </h3>
            <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">AutoCAD Style</span>
          </div>

          {/* Plot Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">منطقة الطباعة (Plot Area):</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="py-1.5 px-3 rounded-lg text-xs font-medium border border-emerald-500 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                onClick={() => {
                  toast.success('تم تحديد كامل حدود الشجرة (Extents)');
                }}
              >
                كامل الشجرة (Extents)
              </button>
              <button
                type="button"
                className="py-1.5 px-3 rounded-lg text-xs font-medium border border-slate-600 bg-slate-800 text-slate-200 hover:border-emerald-500 hover:text-emerald-300 transition-colors"
                onClick={() => {
                  toast('استخدم الماوس للتحريك والتقريب وضبط الكادر المطلوب طباعته حالياً', { icon: '📐' });
                }}
              >
                نافذة محددة (Window)
              </button>
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">لون خلفية الطباعة:</label>
            <select
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500"
              onChange={(e) => {
                document.body.style.backgroundColor = e.target.value;
              }}
            >
              <option value="#ffffff">أبيض (ورق طباعة A0 - موصى به)</option>
              <option value="#0f172a">داكن (نفس مظهر الشاشة)</option>
            </select>
          </div>

          {/* Action Buttons: Preview, Plot, Cancel */}
          <div className="flex gap-2 pt-2 border-t border-slate-700/80">
            <button
              type="button"
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/40 text-xs font-bold py-2 rounded-lg transition-colors"
              onClick={() => {
                toast('تم ضبط المعاينة للكادر الحالي', { icon: '👁️' });
              }}
            >
              معاينة (Preview)
            </button>
            <button
              type="button"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold py-2 rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
              onClick={() => {
                window.print();
              }}
            >
              طباعة (Plot)
            </button>
            <button
              type="button"
              className="px-3 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 text-xs font-medium py-2 rounded-lg transition-colors"
              onClick={() => {
                document.body.style.backgroundColor = '';
                setIsPrinting(false);
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}