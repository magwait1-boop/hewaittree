import { createClient } from '@/lib/supabase/client';
import {
  validateVisitorFeedback,
  type VisitorFeedbackInput,
} from '@/lib/visitorFeedbackValidation';

export interface VisitorFeedback extends VisitorFeedbackInput {
  id: string;
  created_at: string;
  status: 'new' | 'reviewed';
}

export const FEEDBACK_PAGE_SIZE = 25;
const FEEDBACK_FIELDS = 'id,name,phone,message,status,created_at';

export function feedbackErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST204') {
    return 'خدمة الرسائل غير مفعلة حاليًا. يرجى المحاولة لاحقًا.';
  }
  return 'تعذر إتمام العملية. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
}

export async function submitVisitorFeedback(input: VisitorFeedbackInput): Promise<void> {
  const result = validateVisitorFeedback(input);
  if (!result.valid) throw new Error(Object.values(result.errors)[0]);

  // Do not request a returned row: visitors have INSERT permission only.
  const { error } = await createClient().from('visitor_feedback').insert(result.value);
  if (error) throw new Error(feedbackErrorMessage(error));
}

export async function getFeedbackAdminAccess(): Promise<{
  signedIn: boolean;
  allowed: boolean;
  email: string;
}> {
  const client = createClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (!user) {
    if (authError && authError.name !== 'AuthSessionMissingError')
      throw new Error(feedbackErrorMessage(authError));
    return { signedIn: false, allowed: false, email: '' };
  }
  if (authError) throw new Error(feedbackErrorMessage(authError));

  // Membership is read from an immutable-to-clients DB allowlist, never localStorage.
  const { data, error } = await client
    .from('feedback_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw new Error(feedbackErrorMessage(error));
  return { signedIn: true, allowed: Boolean(data), email: user.email ?? '' };
}

export async function fetchVisitorFeedback(
  page = 0
): Promise<{ messages: VisitorFeedback[]; hasMore: boolean }> {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error('رقم الصفحة غير صحيح.');
  const start = page * FEEDBACK_PAGE_SIZE;
  const { data, error } = await createClient()
    .from('visitor_feedback')
    .select(FEEDBACK_FIELDS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + FEEDBACK_PAGE_SIZE);
  if (error) throw new Error(feedbackErrorMessage(error));
  const rows = (data ?? []) as VisitorFeedback[];
  return { messages: rows.slice(0, FEEDBACK_PAGE_SIZE), hasMore: rows.length > FEEDBACK_PAGE_SIZE };
}

export async function markVisitorFeedbackReviewed(id: string): Promise<void> {
  const { data, error } = await createClient()
    .from('visitor_feedback')
    .update({ status: 'reviewed' })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(feedbackErrorMessage(error));
  if (!data) throw new Error('تعذر تحديث الرسالة. تأكد من صلاحية حسابك ثم حدّث القائمة.');
}
