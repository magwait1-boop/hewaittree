'use client';

import { useEffect, useState, type FormEvent } from 'react';
import FeedbackDialog from './FeedbackDialog';
import { createClient } from '@/lib/supabase/client';
import {
  fetchVisitorFeedback,
  getFeedbackAdminAccess,
  markVisitorFeedbackReviewed,
  type VisitorFeedback,
} from '@/lib/visitorFeedbackService';

type Access = 'checking' | 'signed-out' | 'forbidden' | 'ready' | 'error';

export default function FeedbackInboxModal({ onClose }: { onClose: () => void }) {
  const [client] = useState(createClient);
  const [access, setAccess] = useState<Access>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signedInEmail, setSignedInEmail] = useState('');
  const [messages, setMessages] = useState<VisitorFeedback[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      // Only change React state here: awaiting Auth calls inside this callback can deadlock.
      setMessages([]);
      setSignedInEmail(session?.user.email ?? '');
      setPage(0);
      setRefreshVersion((version) => version + 1);
    });
    return () => subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    setAccess('checking');
    setMessages([]);
    setError('');
    const load = async () => {
      try {
        const permission = await getFeedbackAdminAccess();
        if (cancelled) return;
        setSignedInEmail(permission.email);
        if (!permission.signedIn) {
          setAccess('signed-out');
          return;
        }
        if (!permission.allowed) {
          setAccess('forbidden');
          return;
        }
        const result = await fetchVisitorFeedback(page);
        if (cancelled) return;
        setMessages(result.messages);
        setHasMore(result.hasMore);
        setAccess('ready');
      } catch (loadError) {
        if (cancelled) return;
        setAccess('error');
        setError(
          loadError instanceof Error ? loadError.message : 'تعذر تحميل الرسائل. حاول مرة أخرى.'
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [page, refreshVersion]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError('تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور وحاول مرة أخرى.');
        return;
      }
      setPassword('');
    } catch {
      setError('تعذر تسجيل الدخول. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
      setMessages([]);
      setStatus('');
    } catch {
      setError('تعذر تسجيل الخروج. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await markVisitorFeedbackReviewed(id);
      setMessages((previous) =>
        previous.map((message) =>
          message.id === id ? { ...message, status: 'reviewed' } : message
        )
      );
      setStatus('تم تحديد الرسالة كمراجَعة.');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'تعذر تحديث الرسالة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FeedbackDialog title="رسائل الزوار الخاصة" onClose={onClose} busy={busy} wide>
      <p className="text-sm text-muted-foreground leading-7 mb-5">
        يستطيع المسؤول المخوّل فقط الاطلاع على بيانات الزوار ورسائلهم.
      </p>
      {access === 'checking' && (
        <p role="status" className="text-foreground py-8 text-center">
          جارٍ التحقق وتحميل الرسائل…
        </p>
      )}
      {access === 'signed-out' && (
        <form onSubmit={signIn} className="space-y-4">
          <p className="text-sm text-foreground leading-7">
            سجّل الدخول بحساب المسؤول المخصّص لاستقبال الرسائل.
          </p>
          <div>
            <label htmlFor="feedback-admin-email" className="settings-label">
              البريد الإلكتروني للمسؤول
            </label>
            <input
              id="feedback-admin-email"
              type="email"
              autoComplete="username"
              dir="ltr"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
              className="custom-input min-h-11 text-right"
            />
          </div>
          <div>
            <label htmlFor="feedback-admin-password" className="settings-label">
              كلمة المرور
            </label>
            <input
              id="feedback-admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              className="custom-input min-h-11"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="btn-base btn-primary min-h-11 justify-center w-full disabled:opacity-60"
          >
            {busy ? 'جارٍ تسجيل الدخول…' : 'دخول إلى الرسائل'}
          </button>
        </form>
      )}
      {access === 'forbidden' && (
        <p
          role="alert"
          className="border border-danger/40 bg-danger/10 rounded-lg p-4 text-danger text-sm"
        >
          هذا الحساب غير مخوّل لقراءة رسائل الزوار. استخدم حساب المسؤول المخصّص.
        </p>
      )}
      {(access === 'ready' || access === 'forbidden' || access === 'error') && (
        <div className="flex flex-wrap items-center gap-3 mb-5 mt-4">
          {signedInEmail && (
            <p className="text-sm text-muted-foreground break-all flex-1" dir="ltr">
              {signedInEmail}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setRefreshVersion((version) => version + 1)}
            className="btn-base min-h-11"
          >
            تحديث الرسائل
          </button>
          {signedInEmail && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void signOut();
              }}
              className="btn-base min-h-11"
            >
              خروج من الرسائل
            </button>
          )}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="text-danger border border-danger/40 rounded-lg bg-danger/10 p-3 mb-4 text-sm"
        >
          {error}
        </p>
      )}
      {status && (
        <p
          role="status"
          className="text-foreground border border-primary rounded-lg bg-primary/10 p-3 mb-4 text-sm"
        >
          {status}
        </p>
      )}
      {access === 'ready' && (
        <>
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">لا توجد رسائل في هذه الصفحة.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <article key={message.id} className="pending-request-card text-foreground">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <h3 className="font-bold flex-1 break-words">{message.name}</h3>
                    <span
                      className={`text-xs px-3 py-1 rounded-full border ${message.status === 'new' ? 'border-primary bg-primary/10' : 'border-border bg-muted'}`}
                    >
                      {message.status === 'new' ? 'جديدة' : 'تمت المراجعة'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 mb-3">
                    <p>
                      الهاتف:{' '}
                      <bdi dir="ltr" className="text-foreground">
                        {message.phone}
                      </bdi>
                    </p>
                    <time dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleString('ar', {
                        timeZone: 'Asia/Riyadh',
                      })}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7">
                    {message.message}
                  </p>
                  {message.status === 'new' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void markReviewed(message.id);
                      }}
                      className="btn-base btn-primary min-h-11 mt-4 disabled:opacity-60"
                    >
                      تحديد كمراجَعة
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 items-center justify-center mt-5">
            <button
              type="button"
              disabled={page === 0 || busy}
              onClick={() => setPage((previous) => previous - 1)}
              className="btn-base min-h-11 disabled:opacity-50"
            >
              الصفحة السابقة
            </button>
            <span className="text-sm text-muted-foreground">الصفحة {page + 1}</span>
            <button
              type="button"
              disabled={!hasMore || busy}
              onClick={() => setPage((previous) => previous + 1)}
              className="btn-base min-h-11 disabled:opacity-50"
            >
              الصفحة التالية
            </button>
          </div>
        </>
      )}
    </FeedbackDialog>
  );
}
