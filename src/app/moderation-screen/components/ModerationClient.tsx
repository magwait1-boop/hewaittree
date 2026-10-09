'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  MOCK_PERSONS,
  buildPersonMap,
  type Person, type PendingRequest,
} from '@/lib/familyData';
import AppLogo from '@/components/ui/AppLogo';

interface CurrentUser {
  username: string;
  role: 'admin' | 'supervisor';
}

const TYPE_LABELS: Record<string, string> = { add: 'إضافة', edit: 'تعديل', delete: 'حذف' };
const TYPE_COLORS: Record<string, string> = { add: '#10b981', edit: '#f59e0b', delete: '#ef4444' };
const TYPE_ICONS: Record<string, string> = { add: '➕', edit: '✏️', delete: '🗑️' };

type FilterType = 'all' | 'add' | 'edit' | 'delete';

export default function ModerationClient() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ reqId: string; action: 'approve' | 'reject' } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const loadData = () => {
    const backup = localStorage.getItem('fam_nodes_backup');
    setPersons(backup ? JSON.parse(backup) : MOCK_PERSONS);
    const savedRequests = localStorage.getItem('fam_requests');
    if (savedRequests) {
      try { setPendingRequests(JSON.parse(savedRequests)); } catch {}
    } else {
      setPendingRequests([]);
    }
    setLastUpdated(Date.now());
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('fam_current_user');
    if (savedUser) {
      try { setCurrentUser(JSON.parse(savedUser)); } catch {}
    }
    loadData();

    // Cross-tab real-time listener (storage event fires in OTHER tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'fam_requests' || e.key === 'fam_nodes_backup') {
        loadData();
      }
    };

    // Same-tab real-time listener (custom events dispatched by other components)
    const handleRequestsChanged = () => loadData();
    const handleNodesChanged = () => loadData();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('fam_requests_changed', handleRequestsChanged);
    window.addEventListener('fam_nodes_changed', handleNodesChanged);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('fam_requests_changed', handleRequestsChanged);
      window.removeEventListener('fam_nodes_changed', handleNodesChanged);
    };
  }, []);

  const personMap = useMemo(() => buildPersonMap(persons), [persons]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleApprove = (reqId: string) => {
    const req = pendingRequests.find(r => r.reqId === reqId);
    if (!req) return;
    if (req.type === 'add' || req.type === 'edit') {
      if (req.data) {
        setPersons(prev => {
          const idx = prev.findIndex(p => p.id === req.data!.id);
          let updated: Person[];
          if (idx >= 0) { updated = [...prev]; updated[idx] = req.data!; }
          else { updated = [...prev, req.data!]; }
          localStorage.setItem('fam_nodes_backup', JSON.stringify(updated));
          window.dispatchEvent(new Event('fam_nodes_changed'));
          return updated;
        });
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
    }
    setPendingRequests(prev => {
      let updated = prev.filter(r => r.reqId !== reqId);
      localStorage.setItem('fam_requests', JSON.stringify(updated));
      window.dispatchEvent(new Event('fam_requests_changed'));
      return updated;
    });
    setConfirmAction(null);
    showToast('✅ تم اعتماد الطلب بنجاح', 'success');
  };

  const handleReject = (reqId: string) => {
    setPendingRequests(prev => {
      let updated = prev.filter(r => r.reqId !== reqId);
      localStorage.setItem('fam_requests', JSON.stringify(updated));
      window.dispatchEvent(new Event('fam_requests_changed'));
      return updated;
    });
    setConfirmAction(null);
    showToast('❌ تم رفض الطلب', 'error');
  };

  const handleApproveAll = () => {
    const toApprove = filteredRequests;
    let updatedPersons = [...persons];
    toApprove.forEach(req => {
      if (req.type === 'add' || req.type === 'edit') {
        if (req.data) {
          const idx = updatedPersons.findIndex(p => p.id === req.data!.id);
          if (idx >= 0) updatedPersons[idx] = req.data!;
          else updatedPersons.push(req.data!);
        }
      } else if (req.type === 'delete' && req.targetId) {
        updatedPersons = updatedPersons
          .filter(p => p.id !== req.targetId)
          .map(p => p.fatherId === req.targetId ? { ...p, fatherId: '' } : p);
      }
    });
    localStorage.setItem('fam_nodes_backup', JSON.stringify(updatedPersons));
    window.dispatchEvent(new Event('fam_nodes_changed'));
    setPersons(updatedPersons);
    const approvedIds = new Set(toApprove.map(r => r.reqId));
    setPendingRequests(prev => {
      let updated = prev.filter(r => !approvedIds.has(r.reqId));
      localStorage.setItem('fam_requests', JSON.stringify(updated));
      window.dispatchEvent(new Event('fam_requests_changed'));
      return updated;
    });
    showToast(`✅ تم اعتماد ${toApprove.length} طلب`, 'success');
  };

  const filteredRequests = useMemo(() =>
    filter === 'all' ? pendingRequests : pendingRequests.filter(r => r.type === filter),
    [pendingRequests, filter]
  );

  const stats = useMemo(() => ({
    total: pendingRequests.length,
    add: pendingRequests.filter(r => r.type === 'add').length,
    edit: pendingRequests.filter(r => r.type === 'edit').length,
    delete: pendingRequests.filter(r => r.type === 'delete').length,
  }), [pendingRequests]);

  const isAdmin = currentUser?.role === 'admin';
  const canReview = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  return (
    <div className="min-h-screen bg-default-canvas" style={{ direction: 'rtl' }}>
      {/* Header */}
      <header className="glass-panel no-print sticky top-0 z-30 h-14 flex items-center px-4 gap-3">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0 hover:opacity-80 transition-opacity">
          <AppLogo size={32} />
          <span className="font-sans font-black text-sm md:text-base text-foreground leading-tight hidden sm:block">
            شجرة عائلة ال حويت
            <span className="block text-xs font-medium text-muted-foreground">كفر هلال 🌳</span>
          </span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground hidden md:flex items-center gap-1">
            🛡️ لوحة المراجعة
          </span>
          {currentUser && (
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              {currentUser.username}
              <span className={`role-badge ${currentUser.role === 'admin' ? 'role-admin' : 'role-supervisor'}`}>
                {currentUser.role === 'admin' ? 'مسؤول' : 'مشرف'}
              </span>
            </span>
          )}
          <Link href="/" className="btn-base btn-primary text-xs px-3 py-1.5">
            ← الشجرة
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-foreground mb-1">لوحة مراجعة الطلبات</h1>
          <p className="text-sm text-muted-foreground">مراجعة واعتماد أو رفض طلبات إضافة الأعضاء وتعديلات الشجرة
            <span className="mr-2 inline-flex items-center gap-1 text-emerald-400 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
              مباشر
            </span>
          </p>
        </div>

        {/* Access Guard */}
        {!currentUser ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h2 className="text-xl font-black text-foreground mb-2">يتطلب تسجيل الدخول</h2>
            <p className="text-sm text-muted-foreground mb-6">يجب تسجيل الدخول كمشرف أو مسؤول للوصول إلى هذه الصفحة</p>
            <Link href="/" className="btn-base btn-primary px-6 py-2.5">
              العودة للشجرة وتسجيل الدخول
            </Link>
          </div>
        ) : !canReview ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">⛔</div>
            <h2 className="text-xl font-black text-foreground mb-2">غير مصرح</h2>
            <p className="text-sm text-muted-foreground mb-6">هذه الصفحة مخصصة للمشرفين والمسؤولين فقط</p>
            <Link href="/" className="btn-base btn-primary px-6 py-2.5">العودة للشجرة</Link>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'إجمالي الطلبات', value: stats.total, color: '#e2e8f0', icon: '📋' },
                { label: 'طلبات إضافة', value: stats.add, color: '#10b981', icon: '➕' },
                { label: 'طلبات تعديل', value: stats.edit, color: '#f59e0b', icon: '✏️' },
                { label: 'طلبات حذف', value: stats.delete, color: '#ef4444', icon: '🗑️' },
              ].map(stat => (
                <div key={stat.label} className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Filter + Bulk Actions */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1 border border-white/10">
                {(['all', 'add', 'edit', 'delete'] as FilterType[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={filter === f
                      ? { background: '#10b981', color: 'white' }
                      : { color: '#64748b' }
                    }
                  >
                    {f === 'all' ? `الكل (${stats.total})` :
                     f === 'add' ? `إضافة (${stats.add})` :
                     f === 'edit' ? `تعديل (${stats.edit})` :
                     `حذف (${stats.delete})`}
                  </button>
                ))}
              </div>
              {isAdmin && filteredRequests.length > 1 && (
                <button
                  onClick={handleApproveAll}
                  className="btn-base btn-primary text-xs px-4 py-1.5 mr-auto"
                >
                  ✅ اعتماد الكل ({filteredRequests.length})
                </button>
              )}
            </div>

            {/* Requests List */}
            {filteredRequests.length === 0 ? (
              <div className="glass rounded-2xl p-16 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="text-lg font-black text-foreground mb-2">لا توجد طلبات معلقة</h3>
                <p className="text-sm text-muted-foreground">جميع الطلبات تمت معالجتها</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map(req => {
                  const targetName = req.data?.name || (req.targetId ? personMap.get(req.targetId)?.name : '') || 'غير معروف';
                  const fatherName = req.data?.fatherId ? personMap.get(req.data.fatherId)?.name : null;
                  const isExpanded = expandedId === req.reqId;

                  return (
                    <div
                      key={req.reqId}
                      className="glass rounded-xl overflow-hidden transition-all"
                      style={{ border: `1px solid ${TYPE_COLORS[req.type]}33` }}
                    >
                      {/* Card Header */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : req.reqId)}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: `${TYPE_COLORS[req.type]}22`, border: `1px solid ${TYPE_COLORS[req.type]}44` }}
                        >
                          {TYPE_ICONS[req.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-xs font-black px-2 py-0.5 rounded-full"
                              style={{ background: `${TYPE_COLORS[req.type]}22`, color: TYPE_COLORS[req.type], border: `1px solid ${TYPE_COLORS[req.type]}44` }}
                            >
                              {TYPE_LABELS[req.type]}
                            </span>
                            <span className="font-bold text-foreground text-sm">{targetName}</span>
                            {req.data?.branch && (
                              <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                                {req.data.branch}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            بواسطة: <span className="text-foreground/70 font-semibold">{req.by}</span>
                            <span className="mx-2">·</span>
                            {req.createdAt}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isAdmin && (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmAction({ reqId: req.reqId, action: 'approve' }); }}
                                className="btn-base btn-primary text-xs px-3 py-1.5"
                              >
                                ✅ اعتماد
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmAction({ reqId: req.reqId, action: 'reject' }); }}
                                className="btn-base btn-danger text-xs px-3 py-1.5"
                              >
                                ❌ رفض
                              </button>
                            </>
                          )}
                          <span className="text-muted-foreground text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-white/5">
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                            {[
                              { label: 'الاسم', value: targetName },
                              { label: 'الجنس', value: req.data?.gender || '—' },
                              { label: 'الفرع', value: req.data?.branch || '—' },
                              { label: 'الأب', value: fatherName || req.data?.fatherId || '—' },
                              { label: 'تاريخ الميلاد', value: req.data?.birthDate || '—' },
                              { label: 'تاريخ الوفاة', value: req.data?.deathDate || '—' },
                              { label: 'المشرف', value: req.by },
                              { label: 'تاريخ الطلب', value: req.createdAt },
                              { label: 'نوع الطلب', value: TYPE_LABELS[req.type] },
                            ].map(item => (
                              <div key={item.label} className="info-card py-2 px-3">
                                <div className="info-label text-xs">{item.label}</div>
                                <div className="info-value text-sm">{item.value}</div>
                              </div>
                            ))}
                          </div>
                          {req.data?.notes && (
                            <div className="mt-2 lineage-box text-xs">
                              <span className="font-bold">ملاحظات: </span>{req.data.notes}
                            </div>
                          )}
                          {!isAdmin && (
                            <div className="mt-3 text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                              ⚠️ صلاحية المراجعة والاعتماد متاحة للمسؤول فقط
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div
            className="glass-modal modal-enter w-full max-w-sm mx-4 p-6 text-center"
            style={{ direction: 'rtl' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-4xl mb-3">
              {confirmAction.action === 'approve' ? '✅' : '❌'}
            </div>
            <h3 className="text-lg font-black text-foreground mb-2">
              {confirmAction.action === 'approve' ? 'تأكيد الاعتماد' : 'تأكيد الرفض'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {confirmAction.action === 'approve' ?'هل أنت متأكد من اعتماد هذا الطلب وتطبيق التغييرات على الشجرة؟' :'هل أنت متأكد من رفض هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => confirmAction.action === 'approve'
                  ? handleApprove(confirmAction.reqId)
                  : handleReject(confirmAction.reqId)
                }
                className={`btn-base text-sm px-5 py-2 ${confirmAction.action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
              >
                {confirmAction.action === 'approve' ? 'نعم، اعتماد' : 'نعم، رفض'}
              </button>
              <button onClick={() => setConfirmAction(null)} className="btn-base text-sm px-5 py-2">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold shadow-xl"
          style={{
            background: toastMsg.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
            color: 'white',
            border: `1px solid ${toastMsg.type === 'success' ? '#059669' : '#dc2626'}`,
            fontFamily: 'Tajawal, sans-serif',
            direction: 'rtl',
          }}
        >
          {toastMsg.msg}
        </div>
      )}
    </div>
  );
}
