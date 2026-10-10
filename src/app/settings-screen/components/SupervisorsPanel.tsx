'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  addSupervisor,
  deleteSupervisor,
  fetchSupervisors,
  type Supervisor,
} from '@/lib/supervisorService';

export default function SupervisorsPanel() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<Supervisor['id'] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const isBusy = isAdding || deletingId !== null;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError('');
    fetchSupervisors()
      .then((rows) => {
        if (!cancelled) setSupervisors(rows);
      })
      .catch((error) => {
        if (!cancelled)
          setLoadError(error instanceof Error ? error.message : 'تعذر تحميل المشرفين');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    setActionError('');
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password.trim()) {
      setActionError('أدخل اسم المستخدم وكلمة المرور');
      return;
    }
    if (supervisors.some((supervisor) => supervisor.username === normalizedUsername)) {
      setActionError('اسم المستخدم مستخدم بالفعل');
      return;
    }
    setIsAdding(true);
    try {
      const supervisor = await addSupervisor(normalizedUsername, password);
      setSupervisors((current) =>
        [...current, supervisor].sort((a, b) => a.username.localeCompare(b.username, 'ar'))
      );
      setUsername('');
      setPassword('');
      toast.success('تمت إضافة المشرف بنجاح');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'تعذر إضافة المشرف');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (supervisor: Supervisor) => {
    if (isBusy) return;
    setActionError('');
    setDeletingId(supervisor.id);
    try {
      await deleteSupervisor(supervisor.id);
      setSupervisors((current) => current.filter((row) => row.id !== supervisor.id));
      toast.success('تم حذف المشرف');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'تعذر حذف المشرف');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-5 animate-fade-in" aria-labelledby="supervisors-heading">
      <div>
        <h2 id="supervisors-heading" className="mb-1 text-lg font-black text-foreground">
          إدارة المشرفين
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          أضف مشرفاً جديداً أو احذف حساباً من قائمة المشرفين.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="mb-4 text-sm font-bold text-foreground">إضافة مشرف جديد</h3>
        <form
          onSubmit={handleAdd}
          className="supervisor-form grid min-w-0 gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
        >
          <div className="min-w-0">
            <label htmlFor="supervisor-username" className="settings-label">
              اسم المستخدم
            </label>
            <input
              id="supervisor-username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="أدخل اسم المستخدم"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="custom-input"
              required
              disabled={isBusy}
            />
          </div>
          <div className="min-w-0">
            <label htmlFor="supervisor-password" className="settings-label">
              كلمة المرور
            </label>
            <input
              id="supervisor-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="أدخل كلمة المرور"
              autoComplete="new-password"
              className="custom-input"
              required
              disabled={isBusy}
            />
          </div>
          <button
            type="submit"
            disabled={isBusy || isLoading || !!loadError}
            className="btn-base btn-primary min-h-12 justify-center disabled:cursor-wait disabled:opacity-50"
          >
            {isAdding ? 'جارٍ الإضافة...' : 'إضافة مشرف'}
          </button>
        </form>
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          {actionError}
        </p>
      )}

      <div className="settings-section" aria-busy={isLoading || isBusy}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-foreground">المشرفون الحاليون</h3>
          {!isLoading && !loadError && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {supervisors.length}
            </span>
          )}
        </div>
        {isLoading ? (
          <p role="status" className="py-6 text-center text-sm text-muted-foreground">
            جارٍ تحميل المشرفين...
          </p>
        ) : loadError ? (
          <div className="space-y-3 text-center">
            <p role="alert" className="text-sm text-danger">
              {loadError}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="btn-base text-sm"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : supervisors.length === 0 ? (
          <p
            role="status"
            className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-muted-foreground"
          >
            لا يوجد مشرفون حالياً. أضف أول مشرف من النموذج أعلاه.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {supervisors.map((supervisor) => (
              <li
                key={supervisor.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  className="min-w-0 break-all text-sm font-semibold text-foreground"
                  dir="auto"
                >
                  {supervisor.username}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(supervisor)}
                  disabled={isBusy}
                  aria-label={`حذف المشرف ${supervisor.username}`}
                  className="flex min-h-11 flex-shrink-0 items-center gap-2 rounded-xl px-3 text-sm text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {deletingId === supervisor.id ? 'جارٍ الحذف...' : 'حذف'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
