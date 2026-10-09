'use client';
import React, { useEffect, useState } from 'react';
import type { PendingRequest, Person } from '@/lib/familyData';
import { fetchPendingRequests } from '@/lib/famRequestService';
import { createClient } from '@/lib/supabase/client';

interface Props {
  requests: PendingRequest[];
  personMap: Map<string, Person>;
  onApprove: (reqId: string) => void;
  onReject: (reqId: string) => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = { add: 'إضافة', edit: 'تعديل', delete: 'حذف' };
const TYPE_COLORS: Record<string, string> = { add: '#10b981', edit: '#f59e0b', delete: '#ef4444' };

export default function AdminModal({ requests: initialRequests, personMap, onApprove, onReject, onClose }: Props) {
  const [requests, setRequests] = useState<PendingRequest[]>(initialRequests);

  // Sync with parent prop changes
  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  // Subscribe to real-time fam_requests changes while modal is open
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('realtime:fam_requests:admin-modal')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fam_requests' },
        async () => {
          const fresh = await fetchPendingRequests();
          setRequests(fresh);
        }
      )
      .subscribe();

    // Initial fetch to ensure freshness
    fetchPendingRequests().then(r => setRequests(r));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="glass-modal modal-enter w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto scrollbar-thin"
        style={{ direction: 'rtl' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-foreground">الطلبات المعلقة</h2>
            {requests.length > 0 && (
              <span className="badge-pending text-xs px-2 py-0.5 rounded-full" style={{ width: 'auto', height: 'auto' }}>
                {requests.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold">لا توجد طلبات معلقة</p>
            <p className="text-xs mt-1">جميع الطلبات تمت معالجتها</p>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            {requests.map(req => {
              const targetName = req.data?.name || (req.targetId ? personMap.get(req.targetId)?.name : '') || 'غير معروف';
              return (
                <div key={`req-${req.reqId}`} className="pending-request-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full"
                          style={{ background: `${TYPE_COLORS[req.type]}22`, color: TYPE_COLORS[req.type], border: `1px solid ${TYPE_COLORS[req.type]}44` }}
                        >
                          {TYPE_LABELS[req.type]}
                        </span>
                        <span className="text-sm font-bold text-foreground">{targetName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>المشرف: <span className="text-foreground/70 font-semibold">{req.by}</span></p>
                        <p>التاريخ: <span className="text-foreground/70">{req.createdAt}</span></p>
                        {req.data?.branch && <p>الفرع: <span className="text-foreground/70">{req.data.branch}</span></p>}
                        {req.data?.gender && <p>الجنس: <span className="text-foreground/70">{req.data.gender}</span></p>}
                        {req.data?.fatherId && (
                          <p>الأب: <span className="text-foreground/70">{personMap.get(req.data.fatherId)?.name || req.data.fatherId}</span></p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => onApprove(req.reqId)}
                        className="btn-base btn-primary text-xs px-3 py-1.5"
                      >
                        ✅ اعتماد
                      </button>
                      <button
                        onClick={() => onReject(req.reqId)}
                        className="btn-base btn-danger text-xs px-3 py-1.5"
                      >
                        ❌ رفض
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}