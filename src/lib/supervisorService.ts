import { createClient } from '@/lib/supabase/client';
import {
  SUPERVISOR_DEFAULT_PERMISSIONS,
  type PermissionKey,
  type SupervisorPermissions,
} from '@/lib/familyPermissions';

export interface Supervisor extends SupervisorPermissions {
  id: string | number;
  username: string;
}

const SUPERVISOR_FIELDS = 'id, username, can_edit, can_delete, can_moderate, can_style';
export const SUPERVISORS_CHANGED_KEY = 'fam_supervisors_changed';

function notifySupervisorChange() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SUPERVISORS_CHANGED_KEY, `${Date.now()}-${Math.random()}`);
  window.dispatchEvent(new Event(SUPERVISORS_CHANGED_KEY));
}

function supervisorError(code: string | undefined, fallback: string) {
  if (code === '23505') return new Error('اسم المستخدم مستخدم بالفعل');
  if (code === 'PGRST205') return new Error('تعذر العثور على جدول المشرفين في قاعدة البيانات');
  return new Error(fallback);
}

export async function fetchSupervisors(): Promise<Supervisor[]> {
  const { data, error } = await createClient()
    .from('supervisors')
    .select(SUPERVISOR_FIELDS)
    .order('username', { ascending: true })
    .returns<Supervisor[]>();
  if (error) throw supervisorError(error.code, 'تعذر تحميل المشرفين، حاول مرة أخرى');
  return data ?? [];
}

export async function addSupervisor(
  username: string,
  password: string,
  permissions: SupervisorPermissions = SUPERVISOR_DEFAULT_PERMISSIONS
): Promise<Supervisor> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password.trim()) throw new Error('أدخل اسم المستخدم وكلمة المرور');
  const { data, error } = await createClient()
    .from('supervisors')
    .insert({ username: normalizedUsername, password, ...permissions })
    .select(SUPERVISOR_FIELDS)
    .single<Supervisor>();
  if (error) throw supervisorError(error.code, 'تعذر إضافة المشرف، حاول مرة أخرى');
  notifySupervisorChange();
  return data;
}

export async function updateSupervisorPermission(
  id: Supervisor['id'],
  permission: PermissionKey,
  enabled: boolean
): Promise<Supervisor> {
  const { data, error } = await createClient()
    .from('supervisors')
    .update({ [permission]: enabled })
    .eq('id', id)
    .select(SUPERVISOR_FIELDS)
    .single<Supervisor>();
  if (error) throw supervisorError(error.code, 'تعذر تحديث الصلاحية، حاول مرة أخرى');
  notifySupervisorChange();
  return data;
}

export async function authenticateSupervisor(
  username: string,
  password: string
): Promise<Supervisor | null> {
  const { data, error } = await createClient()
    .from('supervisors')
    .select(SUPERVISOR_FIELDS)
    .eq('username', username.trim())
    .eq('password', password)
    .maybeSingle<Supervisor>();
  if (error) throw supervisorError(error.code, 'تعذر تسجيل الدخول، حاول مرة أخرى');
  return data;
}

export async function fetchSupervisorSession(identity: {
  username: string;
  supervisorId?: Supervisor['id'];
}): Promise<Supervisor | null> {
  const query = createClient().from('supervisors').select(SUPERVISOR_FIELDS);
  const { data, error } = await (
    identity.supervisorId !== undefined
      ? query.eq('id', identity.supervisorId)
      : query.eq('username', identity.username)
  ).maybeSingle<Supervisor>();
  if (error) throw supervisorError(error.code, 'تعذر تحديث صلاحيات الحساب');
  return data;
}

export async function deleteSupervisor(id: Supervisor['id']): Promise<void> {
  const { error } = await createClient()
    .from('supervisors')
    .delete()
    .eq('id', id)
    .select('id')
    .single<{ id: Supervisor['id'] }>();
  if (error) throw supervisorError(error.code, 'تعذر حذف المشرف، حاول مرة أخرى');
  notifySupervisorChange();
}
