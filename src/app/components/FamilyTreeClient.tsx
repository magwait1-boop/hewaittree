'use client';
import React, { Component, type ErrorInfo, type ReactNode, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { flushSync } from 'react-dom';
import { MOCK_PERSONS, DEFAULT_SETTINGS, LOCAL_SETTINGS_PENDING_KEY, buildChildrenMap, buildPersonMap, buildNameIndex, searchPersons, normalizeSettings, type Person, type PendingRequest, type AppSettings,  } from '@/lib/familyData';
import type { NameSearchIndex } from '@/lib/arabicSearch';
import { useFamilySession } from '@/contexts/FamilySessionContext';
import { clampTreeZoom, getTreeBounds, getFitView, getMinimumZoom, zoomAtPoint } from '@/lib/treeViewport';
export type { CurrentUser } from '@/lib/familyPermissions';
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
import VisitorFeedbackModal from './VisitorFeedbackModal';
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

function sanitizeView(view: ViewState, minZoom: number): ViewState {
  const safeZoom = clampTreeZoom(view.scale, minZoom);
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

export default function FamilyTreeClient() {
  const [persons, setPersons] = useState<Person[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 0.18 });
  const [canvasRecoveryKey, setCanvasRecoveryKey] = useState(0);
  const canvasRecoveryAttempted = useRef(false);
  const { currentUser, permissions, signIn, signOut } = useFamilySession();
  const [sidebarNodeId, setSidebarNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchQueryRef = useRef('');
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
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [nodeModalParentId, setNodeModalParentId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintReady, setIsPrintReady] = useState(false);
  const [printBackground, setPrintBackground] = useState('#ffffff');
  const onPrintReady = useCallback(() => setIsPrintReady(true), []);
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
  const previousNameIndex = useRef<NameSearchIndex | undefined>(undefined);
  const nameIndex = useMemo(() => buildNameIndex(persons, previousNameIndex.current), [persons]);
  useEffect(() => {
    previousNameIndex.current = nameIndex;
    setSearchMatches(searchPersons(searchQueryRef.current, [], nameIndex));
    setSearchIndex(0);
  }, [nameIndex]);
  const dragSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFitDone = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const getCanvasSize = useCallback(() => {
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    return { w: Math.max(0, rect?.width ?? 1440), h: Math.max(0, rect?.height ?? 800) };
  }, []);
  const [canvasSize, setCanvasSize] = useState({ w: 1440, h: 800 });
  const [hasMeasuredCanvas, setHasMeasuredCanvas] = useState(false);
  const treeBounds = useMemo(() => getTreeBounds(persons, settings, personMap), [persons, settings, personMap]);
  const minZoom = useMemo(() => getMinimumZoom(treeBounds, canvasSize), [treeBounds, canvasSize]);
  const setSafeView = useCallback<React.Dispatch<React.SetStateAction<ViewState>>>((next) => {
    setView(current => sanitizeView(typeof next === 'function' ? next(current) : next, minZoom));
  }, [minZoom]);
  const recoverCanvas = useCallback(() => {
    setSafeView(getFitView(treeBounds, getCanvasSize()));
    if (!canvasRecoveryAttempted.current) {
      canvasRecoveryAttempted.current = true;
      setCanvasRecoveryKey(key => key + 1);
    }
  }, [setSafeView, treeBounds, getCanvasSize]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const measure = () => {
      const { width: w, height: h } = container.getBoundingClientRect();
      if (w <= 0 || h <= 0) return;
      setCanvasSize(previous => previous.w === w && previous.h === h ? previous : { w, h });
      setHasMeasuredCanvas(true);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Preserve a fitted tree when the phone rotates or the viewport changes.
  const previousFit = useRef<ViewState | null>(null);
  useEffect(() => {
    const nextFit = getFitView(treeBounds, canvasSize);
    const oldFit = previousFit.current;
    previousFit.current = nextFit;
    if (!oldFit || !initialFitDone.current) return;
    setSafeView(current => {
      const wasFitted = Math.abs(current.scale - oldFit.scale) < oldFit.scale * 0.001 &&
        Math.abs(current.x - oldFit.x) <= 2 && Math.abs(current.y - oldFit.y) <= 2;
      return wasFitted ? nextFit : current;
    });
  }, [treeBounds, canvasSize, setSafeView]);
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
            const updated = fromRowPublic(payload.new);
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
            try { setSettings(normalizeSettings(JSON.parse(savedSettings))); } catch { /* Ignore malformed cached settings. */ }
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
          try { setSettings(normalizeSettings(JSON.parse(savedSettings))); } catch { /* Ignore malformed cached settings. */ }
        }
        toast.error('خطأ في تحميل البيانات — يُعرض آخر نسخة محلية');
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
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
          try { setSettings(normalizeSettings(JSON.parse(savedSettings))); } catch { /* Ignore malformed cached settings. */ }
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
        try { setSettings(normalizeSettings(JSON.parse(e.newValue))); } catch { /* Ignore malformed cached settings. */ }
      }
    };

    const handleCustomSettingsChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        try { setSettings(typeof detail === 'string' ? normalizeSettings(JSON.parse(detail)) : normalizeSettings(detail as Record<string, unknown>)); } catch { /* Ignore malformed cached settings. */ }
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

  // Fit only after the data and actual viewport dimensions are available.
  useEffect(() => {
    if (!treeBounds || isLoadingData || !hasMeasuredCanvas || initialFitDone.current) return;
    initialFitDone.current = true;
    setSafeView(getFitView(treeBounds, canvasSize));
  }, [treeBounds, isLoadingData, hasMeasuredCanvas, canvasSize, setSafeView]);

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
    searchQueryRef.current = query;
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
    if (!permissions.can_edit) return;
    const p = personMap.get(id);
    if (!p) return;
    setEditingPerson(p);
    setNodeModalParentId('');
    setShowNodeModal(true);
  }, [permissions.can_edit, personMap]);

  const handleZoomChange = useCallback((zoom: number) => {
    if (!Number.isFinite(zoom)) return;
    const { w, h } = getCanvasSize();
    setSafeView(v => zoomAtPoint(v, zoom, { x: w / 2, y: h / 2 }, minZoom));
  }, [setSafeView, getCanvasSize, minZoom]);

  const handleFitToView = useCallback(() => {
    closePersonDetails();
    setSafeView(getFitView(treeBounds, getCanvasSize()));
  }, [treeBounds, setSafeView, getCanvasSize, closePersonDetails]);

  const handleLogin = useCallback(async (username: string, password: string) => {
    await signIn(username, password);
    toast.success(`مرحباً ${username}`);
  }, [signIn]);

  const handleLogout = useCallback(() => {
    signOut();
    toast.success('تم تسجيل الخروج');
  }, [signOut]);

  const handleSavePerson = useCallback(async (data: Person) => {
    if (!permissions.can_edit) return;
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
      const ok = await upsertPerson(data);
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
      const ok = await insertRequest(req);
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
  }, [currentUser, permissions.can_edit]);

  const handleDeletePerson = useCallback(async (id: string) => {
    if (!permissions.can_delete) return;
    if (currentUser?.role === 'admin') {
      setPersons(prev => {
        const updated = prev
          .filter(p => p.id !== id)
          .map(p => p.fatherId === id ? { ...p, fatherId: '' } : p);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
        window.dispatchEvent(new Event('fam_nodes_changed'));
        return updated;
      });
      setSidebarNodeId(null);
      setIsSidebarOpen(false);

      const ok = await deletePersonFromDB(id);
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
      const ok = await insertRequest(req);
      if (ok) {
        toast.success('تم إرسال طلب الحذف للمسؤول');
      } else {
        setPendingRequests(prev => [...prev, req]);
        toast.warning('تم حفظ طلب الحذف محلياً — تعذّر الإرسال للمسؤول');
      }
    }
  }, [currentUser, permissions.can_delete]);

  const handleApproveRequest = useCallback(async (reqId: string) => {
    if (!permissions.can_moderate) return;
    const req = pendingRequests.find(r => r.reqId === reqId);
    if (!req) return;
    const applied = req.type === 'delete'
      ? !!req.targetId && await deletePersonFromDB(req.targetId)
      : !!req.data && await upsertPerson(req.data);
    if (!applied || !await updateRequestStatus(reqId, 'approved')) {
      toast.error('تعذر اعتماد الطلب، حاول مرة أخرى');
      return;
    }
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
      }
    } else if (req.type === 'delete' && req.targetId) {
      setPersons(prev => {
        const updated = prev
          .filter(p => p.id !== req.targetId)
          .map(p => p.fatherId === req.targetId ? { ...p, fatherId: '' } : p);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
        window.dispatchEvent(new Event('fam_nodes_changed'));
        return updated;
      });
    }
    setPendingRequests(prev => prev.filter(r => r.reqId !== reqId));
    toast.success('تم اعتماد الطلب');
  }, [pendingRequests, permissions.can_moderate]);

  const handleRejectRequest = useCallback(async (reqId: string) => {
    if (!permissions.can_moderate) return;
    if (!await updateRequestStatus(reqId, 'rejected')) {
      toast.error('تعذر رفض الطلب');
      return;
    }
    setPendingRequests(prev => prev.filter(r => r.reqId !== reqId));
    toast.error('تم رفض الطلب');
  }, [permissions.can_moderate]);

  const handleNodeDrag = useCallback((id: string, dx: number, dy: number) => {
    if (!permissions.can_style) return;

    // 1. تشغيل حماية السحب (عشان السيرفر ما يتدخلش ويرجع الكارت مكانه)
    isDraggingActiveRef.current = true;

    const selectedAtDrag = selectedIdsRef.current;
    const isBatchDrag = selectedAtDrag.has(id) || selectedIds.has(id);
    const movedIds = isBatchDrag
      ? new Set([...selectedAtDrag, ...selectedIds, id])
      : new Set([id]);

    setPersons(prev => {
      const updated = prev.map(p => {
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
  }, [permissions.can_style, selectedIds]);

  const handleImport = useCallback(async (data: Person[], merge: boolean) => {
    if (currentUser?.role !== 'admin') return;
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
            const updated = [...prev, ...data];
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
          const updated = [...prev, ...data];
          localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
          return updated;
        });
      } else {
        setPersons(data);
        localStorage.setItem('fam_nodes_backup', JSON.stringify(data));
      }
      toast.error(`تم الاستيراد محلياً (${total.toLocaleString('ar-EG')} شخص) — تعذّر الحفظ في قاعدة البيانات`);
    }
  }, [currentUser]);

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
    if (isPrinting) return;
    if (isLoadingData || persons.length === 0) {
      toast('انتظر تحميل البطاقات قبل الطباعة');
      return;
    }
    setIsPrintReady(false);
    setIsPrinting(true);
  }, [isPrinting, isLoadingData, persons.length]);

  // Browser menu / Ctrl+P must include cards outside the screen as well.
  useEffect(() => {
    const preparePrint = () => flushSync(() => setIsPrinting(true));
    window.addEventListener('beforeprint', preparePrint);
    return () => window.removeEventListener('beforeprint', preparePrint);
  }, []);

  const printTree = async () => {
    if (!isPrintReady) return;
    await document.fonts?.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    window.print();
  };

  const openAddPerson = useCallback((parentId = '') => {
    if (!permissions.can_edit) return;
    setEditingPerson(null);
    setNodeModalParentId(parentId);
    setShowNodeModal(true);
  }, [permissions.can_edit]);

  const handleSelectDescendants = useCallback((id: string) => {
    if (!permissions.can_style) return;
    const collect = (nodeId: string, acc: Set<string>) => {
      acc.add(nodeId);
      const children = childrenMapRef.current.get(nodeId) ?? [];
      for (const childId of children) collect(childId, acc);
    };
    const ids = new Set<string>();
    collect(id, ids);
    setSelectedIds(ids);
  }, [permissions.can_style]);

  const handleSaveEdgeStyle = useCallback(async (
    childId: string,
    color: string,
    width: number,
    applyToDescendants: boolean,
  ) => {
    if (!permissions.can_style) return;
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
  }, [permissions.can_style, persons]);

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
        onFeedbackClick={() => setShowFeedbackModal(true)}
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
            minZoom={minZoom}
            setView={setSafeView}
            settings={settings}
            searchMatches={searchMatches}
            selectedIds={selectedIds}
            sidebarNodeId={sidebarNodeId}
            onNodeClick={handleNodeClick}
            onNodeDblClick={handleNodeDblClick}
            onNodeDrag={handleNodeDrag}
            onEdgeClick={setEdgeStylePersonId}
            canEditEdges={permissions.can_style}
            canDrag={permissions.can_style}
            personMap={personMap}
            childrenMap={childrenMap}
            onBgClick={() => {
              setSelectedIds(new Set());
              closePersonDetails();
            }}
            isPrinting={isPrinting}
            printBackground={printBackground}
            onPrintReady={onPrintReady}
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
          if (!permissions.can_edit) return;
          const p = personMap.get(id);
          if (p) { closePersonDetails(); setEditingPerson(p); setShowNodeModal(true); }
        }}
        onAddChild={(parentId) => { closePersonDetails(); openAddPerson(parentId); }}
        onDelete={handleDeletePerson}
        onSelectDescendants={handleSelectDescendants}
        onCenterNode={id => { closePersonDetails(); centerOnNode(id); }}
      />

      {/* Zoom Controls */}
      <ZoomControls minZoom={minZoom} zoom={view.scale} onZoomChange={handleZoomChange} onFit={handleFitToView} />

      {/* Modals */}
      {showFeedbackModal && <VisitorFeedbackModal onClose={() => setShowFeedbackModal(false)} />}
      {showAuthModal && (
        <AuthModal
          onLogin={handleLogin}
          onClose={() => setShowAuthModal(false)}
        />
      )}
      {showNodeModal && permissions.can_edit && (
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
      {edgeStylePersonId && permissions.can_style && personMap.get(edgeStylePersonId) && (
        <EdgeStyleModal
          person={personMap.get(edgeStylePersonId)!}
          onSave={(color, width, applyToDescendants) =>
            handleSaveEdgeStyle(edgeStylePersonId, color, width, applyToDescendants)
          }
          onClose={() => setEdgeStylePersonId(null)}
        />
      )}
      {showAdminModal && permissions.can_moderate && (
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
            background: 'var(--glass-modal)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
            fontFamily: 'Tajawal, sans-serif',
            direction: 'rtl',
          },
        }}
      />

      {isPrinting && (
        <div
          role="dialog"
          aria-labelledby="tree-print-title"
          className="no-print fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm bg-card backdrop-blur border-2 border-primary p-5 rounded-2xl shadow-2xl flex flex-col gap-4 text-foreground"
        >
          <h3 id="tree-print-title" className="font-bold text-base">🖨️ طباعة كامل الشجرة</h3>
          <p className="text-sm text-primary">
            عدد البطاقات في الطباعة: <strong>{persons.length.toLocaleString('ar-EG')}</strong>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            تشمل المعاينة جميع البطاقات والخطوط. يطابق مقاس الصفحة حدودها من جميع الجهات دون هوامش إضافية.
            تُحفظ النصوص والخطوط بجودة متجهية لعرض التفاصيل عند التكبير أو الحفظ بصيغة PDF.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="tree-print-background" className="text-xs font-semibold text-muted-foreground">لون خلفية الطباعة:</label>
            <select
              id="tree-print-background"
              value={printBackground}
              className="custom-input text-xs"
              onChange={event => setPrintBackground(event.target.value)}
            >
              <option value="#ffffff">أبيض</option>
              <option value="#0f172a">داكن</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2 border-t border-border">
            <button
              type="button"
              disabled={!isPrintReady}
              className="btn-base btn-primary flex-1 justify-center text-xs font-bold py-2 disabled:opacity-50"
              onClick={printTree}
            >
              {isPrintReady ? 'طباعة / حفظ PDF' : 'جارٍ تجهيز البطاقات والخطوط…'}
            </button>
            <button
              type="button"
              className="btn-base btn-danger px-3 text-xs py-2"
              onClick={() => setIsPrinting(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
