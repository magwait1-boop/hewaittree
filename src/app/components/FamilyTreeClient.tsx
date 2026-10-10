'use client';
import React, { Component, type ErrorInfo, type ReactNode, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MOCK_PERSONS, DEFAULT_SETTINGS, LOCAL_SETTINGS_PENDING_KEY, SYSTEM_USERS, buildChildrenMap, buildPersonMap, buildNameIndex, searchPersons, normalizeSettings, type Person, type PendingRequest, type AppSettings,  } from '@/lib/familyData';
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
import PersonDetailsModal from './PersonDetailsModal';
import ZoomControls from './ZoomControls';
import NodeModal from './NodeModal';
import EdgeStyleModal from './EdgeStyleModal';
import AdminModal from './AdminModal';
import AuthModal from './AuthModal';
import TreeHeader from './TreeHeader';
import { Toaster, toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const TreeCanvas = dynamic(() => import('./TreeCanvas'), { ssr: false });

function getPendingLocalSettings(): AppSettings | null {
  if (localStorage.getItem(LOCAL_SETTINGS_PENDING_KEY) !== '1') return null;
  const saved = localStorage.getItem('fam_settings');
  if (!saved) return null;
  try { return normalizeSettings(JSON.parse(saved)); } catch { return null; }
}

export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

function sanitizeView(view: ViewState): ViewState {
  const safeZoom = Math.min(Math.max(Number.isFinite(view.scale) ? view.scale : 1, 0.2), 3.0);
  const safePanX = Number.isFinite(view.x) ? Math.round(view.x) : 0;
  const safePanY = Number.isFinite(view.y) ? Math.round(view.y) : 0;
  return { x: safePanX, y: safePanY, scale: safeZoom };
}

interface CanvasErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface CanvasErrorBoundaryState {
  hasError: boolean;
}

class CanvasErrorBoundary extends Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CanvasErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return <div className="h-full w-full" role="status" aria-label="جارٍ استعادة عرض الشجرة" />;
    }
    return this.props.children;
  }
}

export interface CurrentUser {
  username: string;
  role: 'admin' | 'supervisor';
}

export default function FamilyTreeClient() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 0.18 });
  const [canvasRecoveryKey, setCanvasRecoveryKey] = useState(0);
  const canvasRecoveryAttempted = useRef(false);
  const setSafeView = useCallback<React.Dispatch<React.SetStateAction<ViewState>>>((next) => {
    setView(current => sanitizeView(typeof next === 'function' ? next(current) : next));
  }, []);
  const recoverCanvas = useCallback(() => {
    setSafeView({ x: 0, y: 0, scale: 1 });
    if (!canvasRecoveryAttempted.current) {
      canvasRecoveryAttempted.current = true;
      setCanvasRecoveryKey(key => key + 1);
    }
  }, [setSafeView]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [sidebarNodeId, setSidebarNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [nodeModalParentId, setNodeModalParentId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [edgeStylePersonId, setEdgeStylePersonId] = useState<string | null>(null);

  // Derive these maps during render so TreeCanvas always receives indexes for
  // the current persons array. Mutating refs in an effect left the canvas with
  // stale ancestry data because ref updates do not trigger a render.
  const personMap = useMemo(() => buildPersonMap(persons), [persons]);
  const childrenMap = useMemo(() => buildChildrenMap(persons), [persons]);
  const childrenMapRef = useRef(childrenMap);
  useEffect(() => {
    childrenMapRef.current = childrenMap;
  }, [childrenMap]);
  const nameIndex = useMemo(() => buildNameIndex(persons), [persons]);
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFitDone = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const getCanvasSize = useCallback(() => {
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    return { w: Math.max(0, rect?.width ?? 1440), h: Math.max(0, rect?.height ?? 800) };
  }, []);
  const closePersonDetails = useCallback(() => {
    setIsSidebarOpen(false);
    setSidebarNodeId(null);
  }, []);
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
          const pendingSettings = getPendingLocalSettings();
          if (pendingSettings) {
            setSettings(pendingSettings);
            return;
          }
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
        const pendingSettings = getPendingLocalSettings();
        if (pendingSettings) {
          setSettings(pendingSettings);
        } else if (remoteSettings) {
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
      const pendingSettings = getPendingLocalSettings();
      if (pendingSettings) {
        setSettings(pendingSettings);
        return;
      }
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

  // Fit to view on initial load
  useEffect(() => {
    if (persons.length === 0 || initialFitDone.current) return;
    initialFitDone.current = true;
    const xs = persons.map(p => p.manualX);
    const ys = persons.map(p => p.manualY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const { w: W, h: H } = getCanvasSize();
    const scaleX = Math.max(0, W - 100) / (Math.max(0, maxX - minX) || 1);
    const scaleY = Math.max(0, H - 100) / (Math.max(0, maxY - minY) || 1);
    const s = Math.min(scaleX, scaleY, 0.5);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    setSafeView({ x: W / 2 - midX * s, y: H / 2 - midY * s, scale: s });
  }, [persons, setSafeView, getCanvasSize]);

  const centerOnNode = useCallback((id: string, showDetails = false) => {
    const p = personMap.get(id);
    if (!p) return;
    const { w, h } = getCanvasSize();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    // Keep a tapped node in the part of the tree left visible by its details.
    const W = Math.max(0, w - (showDetails && !isMobile ? 360 : 0));
    const H = Math.max(0, h - (showDetails && isMobile ? window.innerHeight * 0.55 : 0));
    const s = 1.3;
    setSafeView({ x: W / 2 - p.manualX * s, y: H / 2 - p.manualY * s, scale: s });
  }, [personMap, setSafeView, getCanvasSize]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    closePersonDetails();
    if (!query.trim()) {
      setSearchMatches([]);
      setSearchIndex(0);
      return;
    }
    const matches = searchPersons(query, persons, nameIndex);
    setSearchMatches(matches);
    setSearchIndex(0);
    if (matches.length > 0) {
      centerOnNode(matches[0]);
    }
  }, [persons, nameIndex, centerOnNode, closePersonDetails]);

  const navigateSearch = useCallback((dir: 'prev' | 'next') => {
    if (searchMatches.length === 0) return;
    const newIdx = dir === 'next'
      ? (searchIndex + 1) % searchMatches.length
      : (searchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchIndex(newIdx);
    closePersonDetails();
    centerOnNode(searchMatches[newIdx]);
  }, [searchMatches, searchIndex, centerOnNode, closePersonDetails]);

  const handleNodeClick = useCallback((id: string) => {
    if (!personMap.has(id)) return;
    setSidebarNodeId(id);
    setIsSidebarOpen(true);
    centerOnNode(id, true);
  }, [personMap, centerOnNode]);

  const handleNodeDblClick = useCallback((id: string) => {
    if (!currentUser) return;
    const p = personMap.get(id);
    if (!p) return;
    setEditingPerson(p);
    setNodeModalParentId('');
    setShowNodeModal(true);
  }, [currentUser, personMap]);

  const handleZoomChange = useCallback((zoom: number) => {
    if (!Number.isFinite(zoom)) return;
    setSafeView(v => ({ ...v, scale: zoom }));
  }, [setSafeView]);

  const handleFitToView = useCallback(() => {
    if (persons.length === 0) return;
    const xs = persons.map(p => p.manualX);
    const ys = persons.map(p => p.manualY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const { w: W, h: H } = getCanvasSize();
    const s = Math.min(Math.max(0, W - 100) / (Math.max(0, maxX - minX) || 1), Math.max(0, H - 100) / (Math.max(0, maxY - minY) || 1), 0.5);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    setSafeView({ x: W / 2 - midX * s, y: H / 2 - midY * s, scale: s });
  }, [persons, setSafeView, getCanvasSize]);

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

    const selectedAtDrag = selectedIdsRef.current;
    const isBatchDrag = selectedAtDrag.has(id) || selectedIds.has(id);
    const movedIds = isBatchDrag
      ? new Set([...selectedAtDrag, ...selectedIds, id])
      : new Set([id]);

    setPersons(prev => {
      let updated = prev.map(p => {
        if (movedIds.has(p.id)) {
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

  const handleSaveEdgeStyle = useCallback(async (
    childId: string,
    color: string,
    width: number,
    applyToDescendants: boolean,
  ) => {
    if (currentUser?.role !== 'admin') return;
    const affectedIds = new Set<string>();
    const collect = (personId: string) => {
      if (affectedIds.has(personId)) return;
      affectedIds.add(personId);
      if (applyToDescendants) {
        for (const descendantId of childrenMapRef.current.get(personId) ?? []) collect(descendantId);
      }
    };
    collect(childId);

    const updated = persons.map(person => affectedIds.has(person.id)
      ? { ...person, edgeColor: color, edgeWidth: width }
      : person);
    setPersons(updated);
    localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
    window.dispatchEvent(new Event('fam_nodes_changed'));
    setEdgeStylePersonId(null);

    const affectedPersons = updated.filter(person => affectedIds.has(person.id));
    const results = await Promise.all(affectedPersons.map(upsertPerson));
    if (results.every(Boolean)) toast.success('تم حفظ تنسيق خطوط الاتصال بنجاح');
    else toast.error('تم تطبيق التنسيق محلياً، وتعذّر حفظ بعض التعديلات في قاعدة البيانات');
  }, [currentUser, persons]);

  return (
    <div className="family-tree relative w-screen h-screen overflow-hidden" style={{ direction: 'rtl' }}>
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
      {/* Top Header */}
      <TreeHeader
        currentUser={currentUser}
        totalPersons={persons.length}
        onLoginClick={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onPrint={handlePrint}
      />

      {/* Toolbar */}
      <TreeToolbar
        persons={persons}
        currentUser={currentUser}
        pendingCount={pendingRequests.length}
        searchQuery={searchQuery}
        searchMatches={searchMatches}
        searchIndex={searchIndex}
        onSearch={handleSearch}
        onNavigateSearch={navigateSearch}
        onAddPerson={() => openAddPerson()}
        onOpenAdmin={() => setShowAdminModal(true)}
        onImport={handleImport}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        onOpenSettings={() => window.location.href = '/settings-screen'}
        onPrint={handlePrint}
      />

      {/* Tree Canvas */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 tree-canvas-wrap touch-none"
        style={{ top: 'var(--tree-controls-height)', touchAction: 'none', overscrollBehavior: 'none' }}
      >
        <CanvasErrorBoundary key={canvasRecoveryKey} onError={recoverCanvas}>
          <TreeCanvas
            persons={persons}
            view={view}
            setView={setSafeView}
            settings={settings}
            searchMatches={searchMatches}
            selectedIds={selectedIds}
            sidebarNodeId={sidebarNodeId}
            onNodeClick={handleNodeClick}
            onNodeDblClick={handleNodeDblClick}
            onNodeDrag={handleNodeDrag}
            onEdgeClick={setEdgeStylePersonId}
            canEditEdges={currentUser?.role === 'admin'}
            canDrag={currentUser?.role === 'admin'}
            personMap={personMap}
            childrenMap={childrenMap}
            onBgClick={() => {
              setSelectedIds(new Set());
              closePersonDetails();
            }}
            isPrinting={isPrinting}
            onPrintDone={() => setIsPrinting(false)}
          />
        </CanvasErrorBoundary>
      </div>

      {/* Details open only after a node tap or click. */}
      <PersonDetailsModal
        isOpen={isSidebarOpen}
        nodeId={sidebarNodeId}
        persons={persons}
        personMap={personMap}
        childrenMap={childrenMap}
        currentUser={currentUser}
        onClose={closePersonDetails}
        onEdit={(id) => {
          const p = personMap.get(id);
          if (p) { closePersonDetails(); setEditingPerson(p); setShowNodeModal(true); }
        }}
        onAddChild={(parentId) => { closePersonDetails(); openAddPerson(parentId); }}
        onDelete={handleDeletePerson}
        onSelectDescendants={handleSelectDescendants}
        onCenterNode={id => { closePersonDetails(); centerOnNode(id); }}
      />

      {/* Zoom Controls */}
      <ZoomControls zoom={view.scale} onZoomChange={handleZoomChange} onFit={handleFitToView} />

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
          personMap={personMap}
          onSave={handleSavePerson}
          onClose={() => { setShowNodeModal(false); setEditingPerson(null); }}
        />
      )}
      {edgeStylePersonId && currentUser?.role === 'admin' && personMap.get(edgeStylePersonId) && (
        <EdgeStyleModal
          person={personMap.get(edgeStylePersonId)!}
          onSave={(color, width, applyToDescendants) =>
            handleSaveEdgeStyle(edgeStylePersonId, color, width, applyToDescendants)
          }
          onClose={() => setEdgeStylePersonId(null)}
        />
      )}
      {showAdminModal && currentUser?.role === 'admin' && (
        <AdminModal
          requests={pendingRequests}
          personMap={personMap}
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
