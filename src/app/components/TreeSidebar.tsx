'use client';
import React, { useMemo } from 'react';
import type { Person } from '@/lib/familyData';
import { getGeneration, getLineage, getTotalDescendants } from '@/lib/familyData';
import type { CurrentUser } from './FamilyTreeClient';

interface Props {
  nodeId: string | null;
  persons: Person[];
  personMap: Map<string, Person>;
  childrenMap: Map<string, string[]>;
  currentUser: CurrentUser | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onSelectDescendants: (id: string) => void;
  onCenterNode: (id: string) => void;
  compact?: boolean;
  titleId?: string;
}

const BRANCH_COLORS: Record<string, string> = {
  'احمد1': '#10b981', 'موسى1': '#db0677', 'حسين1': '#dc2626',
  'الأصل': '#e1d019', 'احمد': '#059669', 'عبدالناصر': '#8b5cf6',
  'المكنة': '#f59e0b', 'مجدي': '#6366f1', 'شعبان': '#ec4899'
};

export default function TreeSidebar({
  nodeId, persons, personMap, childrenMap, currentUser,
  onClose, onEdit, onAddChild, onDelete, onSelectDescendants, onCenterNode,
  compact = false, titleId,
}: Props) {
  const person = nodeId ? personMap.get(nodeId) : null;

  const generation = useMemo(() => {
    if (!nodeId) return 0;
    return getGeneration(nodeId, personMap);
  }, [nodeId, personMap]);

  const lineage = useMemo(() => {
    if (!nodeId) return '';
    return getLineage(nodeId, personMap);
  }, [nodeId, personMap]);

  const childrenCount = useMemo(() => {
    if (!nodeId) return 0;
    return (childrenMap.get(nodeId) || []).length;
  }, [nodeId, childrenMap]);

  const totalDescendants = useMemo(() => {
    if (!nodeId) return 0;
    return getTotalDescendants(nodeId, childrenMap);
  }, [nodeId, childrenMap]);

  const directChildren = useMemo(() => {
    if (!nodeId) return [];
    return (childrenMap.get(nodeId) || []).map((id) => personMap.get(id)).filter(Boolean) as Person[];
  }, [nodeId, childrenMap, personMap]);

  const isEditor = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const isAdmin = currentUser?.role === 'admin';

  if (!person) {
    return (
      <aside className="glass-sidebar w-full h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <div className="text-4xl mb-3">👤</div>
          <p className="text-sm">انقر على شخص في الشجرة لعرض بياناته</p>
        </div>
      </aside>);

  }

  const branchColor = BRANCH_COLORS[person.branch] || '#94a3b8';

  return (
    <aside
      className="glass-sidebar w-full h-full min-h-0 flex flex-col overflow-hidden"
      style={{ direction: 'rtl' }}>

      {/* Header */}
      <div className={`flex items-start justify-between gap-2 p-4 border-b border-white/10 flex-shrink-0 ${compact ? '' : 'mt-[54px]'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-black flex-shrink-0"
            style={{ background: person.leafColor || (person.gender === 'أنثى' ? '#fcd9d9' : '#add7a0'), color: '#0f172a' }}>

            {person.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-black text-foreground leading-snug break-words">{person.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {person.branch &&
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${branchColor}22`, color: branchColor, border: `1px solid ${branchColor}44` }}>

                  {person.branch}
                </span>
              }
              {person.gender &&
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${person.gender === 'ذكر' ? 'bg-blue-500/15 text-blue-300' : 'bg-pink-500/15 text-pink-300'}`}>
                  {person.gender}
                </span>
              }
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          data-details-close
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-foreground hover:bg-white/10 transition-colors text-xl leading-none"
          aria-label="إغلاق">

          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin p-4 space-y-3">
        {/* Info Card */}
        <div className="info-card">
          {[
          { label: 'الجيل', value: `الجيل ${generation}` },
          { label: 'الأبناء المباشرون', value: `${childrenCount} ابن/ابنة` },
          { label: 'إجمالي الذرية', value: `${totalDescendants.toLocaleString('ar-EG')} شخص` },
          person.birthDate ? { label: 'تاريخ الميلاد', value: person.birthDate } : null,
          person.deathDate ? { label: 'تاريخ الوفاة', value: person.deathDate } : null].
          filter(Boolean).map((row, i) =>
          <div key={`info-${i}`} className="info-row">
              <span className="info-label">{row!.label}</span>
              <span className="info-value">{row!.value}</span>
            </div>
          )}
        </div>

        {/* Lineage */}
        {lineage &&
        <div>
            <p className="settings-label mb-2">سلسلة النسب</p>
            <div className="lineage-box text-xs leading-relaxed">{lineage}</div>
          </div>
        }

        {/* Notes */}
        {person.notes &&
        <div className="info-card">
            <p className="text-xs font-semibold text-warning mb-1">ملاحظات</p>
            <p className="text-sm text-foreground/80">{person.notes}</p>
          </div>
        }

        {/* Direct Children */}
        {directChildren.length > 0 &&
        <div>
            <p className="settings-label mb-2">الأبناء المباشرون ({directChildren.length})</p>
            <div className="space-y-1 max-h-36 overflow-y-auto scrollbar-thin">
              {directChildren.map((child) =>
            <button
              key={`child-${child.id}`}
              onClick={() => onCenterNode(child.id)}
              className="w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/06 transition-colors text-sm font-medium text-foreground/80 hover:text-foreground">

                  <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: child.leafColor || (child.gender === 'أنثى' ? '#fcd9d9' : '#add7a0') }} />

                  {child.name}
                  {child.gender &&
              <span className="text-xs text-muted-foreground mr-auto">{child.gender}</span>
              }
                </button>
            )}
            </div>
          </div>
        }

        {/* Actions */}
        {isEditor &&
        <div className="space-y-2 pt-2 border-t border-white/10">
            <button
            onClick={() => onEdit(person.id)}
            className="btn-base btn-primary w-full justify-center text-sm">

              ✎ تعديل بيانات الشخص
            </button>
            <div className="flex gap-2">
              <button
              onClick={() => onAddChild(person.id)}
              className="btn-base flex-1 justify-center text-sm"
              style={{ borderColor: '#3b82f6', color: '#93c5fd' }}>

                + إضافة ابن
              </button>
              <button
              onClick={() => {
                if (window.confirm(`هل تريد حذف "${person.name}"؟ لا يمكن التراجع.`)) {
                  onDelete(person.id);
                }
              }}
              className="btn-base btn-danger flex-1 justify-center text-sm">

                حذف
              </button>
            </div>
            {isAdmin &&
          <button
            onClick={() => onSelectDescendants(person.id)}
            className="btn-ghost btn-base w-full justify-center text-sm">

                تحديد الذرية كاملة للسحب
              </button>
          }
          </div>
        }
      </div>
    </aside>);

}
