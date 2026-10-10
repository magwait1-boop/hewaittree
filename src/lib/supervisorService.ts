import { createClient } from '@/lib/supabase/client';

export interface Supervisor {
  id: string | number;
  username: string;
}

function supervisorError(code: string | undefined, fallback: string) {
  if (code === '23505') return new Error('اسم المستخدم مستخدم بالفعل');
  if (code === 'PGRST205') return new Error('تعذر العثور على جدول المشرفين في قاعدة البيانات');
  return new Error(fallback);
}

export async function fetchSupervisors(): Promise<Supervisor[]> {
  const { data, error } = await createClient()
    .from('supervisors')
    .select('id, username')
    .order('username', { ascending: true })
    .returns<Supervisor[]>();
  if (error) throw supervisorError(error.code, 'تعذر تحميل المشرفين، حاول مرة أخرى');
  return data ?? [];
}

export async function addSupervisor(username: string, password: string): Promise<Supervisor> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername || !password.trim()) throw new Error('أدخل اسم المستخدم وكلمة المرور');
  const { data, error } = await createClient()
    .from('supervisors')
    .insert({ username: normalizedUsername, password })
    .select('id, username')
    .single<Supervisor>();
  if (error) throw supervisorError(error.code, 'تعذر إضافة المشرف، حاول مرة أخرى');
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
}
