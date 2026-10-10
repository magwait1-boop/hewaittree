'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  addSupervisor,
  deleteSupervisor,
  fetchSupervisors,
  updateSupervisorPermission,
  type Supervisor,
} from '@/lib/supervisorService';
import {
  PERMISSION_OPTIONS,
  SUPERVISOR_DEFAULT_PERMISSIONS,
  type PermissionKey,
  type SupervisorPermissions,
} from '@/lib/familyPermissions';

export default function SupervisorsPanel() {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState<SupervisorPermissions>({
    ...SUPERVISOR_DEFAULT_PERMISSIONS,
  });
  const [updatingPermission, setUpdatingPermission] = useState<{
    id: Supervisor['id'];
    key: PermissionKey;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<Supervisor['id'] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const isBusy = isAdding || deletingId !== null || updatingPermission !== null;

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
      const supervisor = await addSupervisor(normalizedUsername, password, permissions);
      setSupervisors((current) =>
        [...current, supervisor].sort((a, b) => a.username.localeCompare(b.username, 'ar'))
      );
      setUsername('');
      setPassword('');
      setPermissions({ ...SUPERVISOR_DEFAULT_PERMISSIONS });
      toast.success('تمت إضافة المشرف بنجاح');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'تعذر إضافة المشرف');
    } finally {
      setIsAdding(false);
    }
  };

  const handlePermissionToggle = async (supervisor: Supervisor, key: PermissionKey) => {
    if (isBusy) return;
    setActionError('');
    setUpdatingPermission({ id: supervisor.id, key });
    const enabled = !supervisor[key];
    setSupervisors((current) =>
      current.map((row) => (row.id === supervisor.id ? { ...row, [key]: enabled } : row))
    );
    try {
      const updated = await updateSupervisorPermission(supervisor.id, key, enabled);
      setSupervisors((current) => current.map((row) => (row.id === supervisor.id ? updated : row)));
    } catch (error) {
      setSupervisors((current) =>
        current.map((row) => (row.id === supervisor.id ? supervisor : row))
      );
      setActionError(error instanceof Error ? error.message : 'تعذر تحديث الصلاحية');
    } finally {
      setUpdatingPermission(null);
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
          أضف المشرفين وحدد صلاحياتهم، أو عدّلها مباشرة من القائمة.
        </p>
      </div>

      <div className="settings-section">
        <h3 className="mb-4 text-sm font-bold text-foreground">إضافة مشرف جديد</h3>
        <form onSubmit={handleAdd} className="supervisor-form grid min-w-0 gap-3 sm:grid-cols-2">
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
          <fieldset disabled={isBusy} className="min-w-0 sm:col-span-2">
            <legend className="settings-label mb-2">صلاحيات المشرف</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PERMISSION_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={permissions[option.key]}
                    onChange={(event) =>
                      setPermissions((current) => ({
                        ...current,
                        [option.key]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 shrink-0 accent-emerald-500"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={isBusy || isLoading || !!loadError}
            className="btn-base btn-primary min-h-12 justify-center disabled:cursor-wait disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
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
              <li key={supervisor.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
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
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={`صلاحيات ${supervisor.username}`}
                >
                  {PERMISSION_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={supervisor[option.key] === true}
                      aria-label={`${option.label} — ${supervisor.username}`}
                      disabled={isBusy}
                      onClick={() => handlePermissionToggle(supervisor, option.key)}
                      className={`flex min-h-11 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-right text-xs font-semibold transition-colors disabled:opacity-60 ${supervisor[option.key] ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-muted-foreground'}`}
                    >
                      <span aria-hidden="true">
                        {updatingPermission?.id === supervisor.id &&
                        updatingPermission.key === option.key
                          ? '…'
                          : supervisor[option.key]
                            ? '✓'
                            : '−'}
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
