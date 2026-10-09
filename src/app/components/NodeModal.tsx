'use client';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Person } from '@/lib/familyData';
import type { CurrentUser } from './FamilyTreeClient';

interface Props {
  editing: Person | null;
  parentId: string;
  persons: Person[];
  currentUser: CurrentUser | null;
  personMap: Map<string, Person>;
  onSave: (data: Person) => void;
  onClose: () => void;
}

export default function NodeModal({ editing, parentId, persons, currentUser, personMap, onSave, onClose }: Props) {
  const isEdit = !!editing?.id;
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<Person>();

  // Watch color fields for live preview
  const watchedBg = watch('cardBgColor');
  const watchedText = watch('cardTextColor');
  const watchedBorder = watch('cardBorderColor');
  const watchedLeaf = watch('leafColor');

  useEffect(() => {
    if (editing) {
      reset(editing);
    } else {
      const parent = parentId ? personMap.get(parentId) : null;
      reset({
        id: '',
        name: '',
        gender: 'ذكر',
        branch: parent?.branch || '',
        fatherId: parentId || '',
        birthDate: '',
        deathDate: '',
        notes: '',
        leafColor: '',
        nodeScale: 1,
        // تحويل إحداثيات الأب لأرقام صحيحة لتفادي أي أخطاء حسابية
        manualX: parent ? Number(parent.manualX) : 3000,
        manualY: parent ? Number(parent.manualY) + 150 : 0,
        cardBgColor: '',
        cardTextColor: '',
        cardWidth: undefined,
        cardHeight: undefined,
        cardFontSize: undefined,
        cardBorderColor: '',
        cardBorderWidth: undefined,
        cardBorderRadius: undefined,
      });
    }
  }, [editing, parentId, reset, personMap]);

  const onSubmit = (data: Person) => {
    const id = data.id || `p_${Date.now()}`;
    const cleaned: Person = {
      ...data,
      id,
      // تأكيد تحويل الإحداثيات لأرقام عند الحفظ لمنع طيران البطاقة
      manualX: Number(data.manualX) || 3000,
      manualY: Number(data.manualY) || 0,
      cardBgColor: data.cardBgColor || undefined,
      cardTextColor: data.cardTextColor || undefined,
      cardBorderColor: data.cardBorderColor || undefined,
      leafColor: data.leafColor || undefined,
      cardWidth: data.cardWidth ? Number(data.cardWidth) : undefined,
      cardHeight: data.cardHeight ? Number(data.cardHeight) : undefined,
      cardFontSize: data.cardFontSize ? Number(data.cardFontSize) : undefined,
      cardBorderWidth: data.cardBorderWidth ? Number(data.cardBorderWidth) : undefined,
      cardBorderRadius: data.cardBorderRadius !== undefined && data.cardBorderRadius !== null && String(data.cardBorderRadius) !== '' ? Number(data.cardBorderRadius) : undefined,
    };
    onSave(cleaned);
  };

  const isAdmin = currentUser?.role === 'admin';

  // Live preview style
  const previewBg = watchedBg || watchedLeaf || '#add7a0';
  const previewText = watchedText || '#0f172a';
  const previewBorder = watchedBorder || 'rgba(255,255,255,0.2)';

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="glass-modal modal-enter w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto scrollbar-thin"
        style={{ direction: 'rtl' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-foreground">
            {isEdit ? 'تعديل بيانات الشخص' : 'إضافة شخص جديد'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">✕</button>
        </div>

        {!isAdmin && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-warning text-xs mb-4">
            سيتم إرسال هذا الطلب للمسؤول للمراجعة والاعتماد
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-6">
          <input type="hidden" {...register('id')} />
          <input type="hidden" {...register('manualX')} />
          <input type="hidden" {...register('manualY')} />

          {/* ── Basic Info ── */}
          <div>
  <label className="settings-label">الاسم *</label>
  <input
    type="text"
    autoFocus
    className="custom-input w-full"
    placeholder="مثال: محمد"
    {...register('name', { required: 'الاسم مطلوب' })}
  />
  {errors.name && <p className="text-danger text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="settings-label">الجنس</label>
              <select className="custom-select" {...register('gender')}>
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
                <option value="">غير محدد</option>
              </select>
            </div>
            <div>
              <label className="settings-label">الفرع / الفخذ</label>
              <input type="text" className="custom-input" placeholder="مثال: احمد1" {...register('branch')} />
            </div>
          </div>

          <div>
            <label className="settings-label">الأب</label>
            <select className="custom-select" {...register('fatherId')}>
              <option value="">-- بدون أب (أصل جديد) --</option>
              {persons.map(p => (
                <option key={`father-opt-${p.id}`} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="settings-label">تاريخ الميلاد</label>
              <input type="date" className="custom-input" {...register('birthDate')} />
            </div>
            <div>
              <label className="settings-label">تاريخ الوفاة</label>
              <input type="date" className="custom-input" {...register('deathDate')} />
            </div>
          </div>

          <div>
            <label className="settings-label">ملاحظات</label>
            <textarea className="custom-input resize-none" rows={2} placeholder="أي ملاحظات إضافية..." {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-base btn-danger flex-1 justify-center">إلغاء</button>
            <button type="submit" disabled={isSubmitting} className="btn-base btn-primary flex-1 justify-center">
              {isSubmitting ? '...' : isAdmin ? 'حفظ التعديلات' : 'إرسال الطلب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}