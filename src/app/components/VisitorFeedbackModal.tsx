'use client';

import { useRef, useState, type FormEvent } from 'react';
import FeedbackDialog from './FeedbackDialog';
import { submitVisitorFeedback } from '@/lib/visitorFeedbackService';
import {
  FEEDBACK_LIMITS,
  validateVisitorFeedback,
  type VisitorFeedbackErrors,
  type VisitorFeedbackInput,
} from '@/lib/visitorFeedbackValidation';

export default function VisitorFeedbackModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<VisitorFeedbackInput>({ name: '', phone: '', message: '' });
  const [errors, setErrors] = useState<VisitorFeedbackErrors>({});
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  const update = (field: keyof VisitorFeedbackInput, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const result = validateVisitorFeedback(form);
    setErrors(result.errors);
    setError('');
    if (!result.valid) {
      const field = Object.keys(result.errors)[0];
      formRef.current
        ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)
        ?.focus();
      return;
    }
    submittingRef.current = true;
    setSending(true);
    try {
      await submitVisitorFeedback(result.value);
      setForm({ name: '', phone: '', message: '' });
      setSent(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'تعذر إرسال الرسالة. حاول مرة أخرى.'
      );
    } finally {
      submittingRef.current = false;
      setSending(false);
    }
  };

  return (
    <FeedbackDialog title="تقديم مقترح أو تعليق" onClose={onClose} busy={sending}>
      {sent ? (
        <div className="space-y-5">
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-primary bg-primary/10 p-5 text-foreground"
          >
            <p className="font-bold text-lg mb-2">تم إرسال رسالتك بنجاح.</p>
            <p className="text-sm leading-7">
              شكرًا لمشاركتك. وصلت رسالتك إلى صندوق المسؤول الخاص للمراجعة.
            </p>
          </div>
          <button
            type="button"
            className="btn-base btn-primary min-h-11 w-full justify-center"
            onClick={onClose}
          >
            تم
          </button>
        </div>
      ) : (
        <form ref={formRef} onSubmit={submit} noValidate className="space-y-4" aria-busy={sending}>
          <p id="feedback-privacy" className="text-sm text-muted-foreground leading-7">
            بياناتك ورسالتك خاصة بالموقع والمسؤول، ولا تظهر للزوار.
          </p>
          <div>
            <label htmlFor="feedback-name" className="settings-label">
              اسم الزائر *
            </label>
            <input
              id="feedback-name"
              name="name"
              data-dialog-autofocus
              autoComplete="name"
              required
              maxLength={FEEDBACK_LIMITS.name}
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              disabled={sending}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'feedback-name-error' : undefined}
              className="custom-input min-h-11"
            />
            {errors.name && (
              <p id="feedback-name-error" role="alert" className="text-danger text-sm mt-1">
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="feedback-phone" className="settings-label">
              رقم الهاتف *
            </label>
            <input
              id="feedback-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              required
              maxLength={FEEDBACK_LIMITS.phone}
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              disabled={sending}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'feedback-phone-error' : undefined}
              className="custom-input min-h-11 text-right"
            />
            {errors.phone && (
              <p id="feedback-phone-error" role="alert" className="text-danger text-sm mt-1">
                {errors.phone}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="feedback-message" className="settings-label">
              نص المقترح أو التعليق *
            </label>
            <textarea
              id="feedback-message"
              name="message"
              required
              rows={5}
              maxLength={FEEDBACK_LIMITS.message}
              value={form.message}
              onChange={(event) => update('message', event.target.value)}
              disabled={sending}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={`feedback-privacy${errors.message ? ' feedback-message-error' : ''}`}
              className="custom-input resize-y min-h-32"
            />
            {errors.message && (
              <p id="feedback-message-error" role="alert" className="text-danger text-sm mt-1">
                {errors.message}
              </p>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="text-danger rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={sending}
            className="btn-base btn-primary min-h-11 w-full justify-center disabled:opacity-60"
          >
            {sending ? 'جارٍ الإرسال…' : 'إرسال الرسالة'}
          </button>
        </form>
      )}
    </FeedbackDialog>
  );
}
