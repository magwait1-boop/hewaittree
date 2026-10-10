'use client';
import React, { useMemo, useRef } from 'react';
import type { CurrentUser } from './FamilyTreeClient';
import type { Person } from '@/lib/familyData';

interface Props {
  persons: Person[];
  currentUser: CurrentUser | null;
  pendingCount: number;
  searchQuery: string;
  searchMatches: string[];
  searchIndex: number;
  onSearch: (query: string) => void;
  onNavigateSearch: (direction: 'prev' | 'next') => void;
  onAddPerson: () => void;
  onOpenAdmin: () => void;
  onImport: (data: Person[], merge: boolean) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onOpenSettings: () => void;
  onPrint?: () => void;
}

export default function TreeToolbar({
  persons, currentUser, pendingCount,
  searchQuery, searchMatches, searchIndex, onSearch, onNavigateSearch,
  onAddPerson, onOpenAdmin,
  onOpenSettings, onPrint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditor = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const isAdmin = currentUser?.role === 'admin';

  const totalPersons = persons.length;
  const totalBranches = useMemo(
    () => new Set(persons.map(p => p.branch?.trim()).filter(Boolean)).size,
    [persons]
  );

  return (
    <div
      className="glass-panel no-print absolute top-14 left-0 right-0 z-30 flex flex-col sm:h-12 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
      style={{ direction: 'rtl' }}>

      <form
        role="search"
        className="w-full min-w-0 px-3 py-2 sm:flex-1 sm:px-0 sm:py-0"
        onSubmit={event => { event.preventDefault(); inputRef.current?.blur(); }}
      >
        <div className="relative">
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="search"
            value={searchQuery}
            onChange={event => onSearch(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') { onSearch(''); inputRef.current?.blur(); }
            }}
            placeholder="ابحث عن اسم في العائلة..."
            aria-label="البحث عن شخص بالاسم"
            aria-describedby="tree-search-count"
            autoComplete="off"
            enterKeyHint="search"
            className="tree-search-input h-12 w-full min-w-0 rounded-xl border border-white/15 bg-slate-950/50 py-3 pl-12 pr-10 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 sm:h-10 sm:py-2"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { onSearch(''); inputRef.current?.focus(); }}
              className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-lg text-muted-foreground hover:text-foreground"
              aria-label="مسح البحث"
            >✕</button>
          )}
        </div>
      </form>

      <div className="flex h-11 w-full min-w-0 items-center justify-between gap-2 px-3 sm:h-12 sm:w-auto sm:flex-shrink-0 sm:px-0">
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onNavigateSearch('prev')}
            disabled={searchMatches.length < 2}
            className="search-step-button"
            aria-label="النتيجة السابقة"
            title="النتيجة السابقة"
          >▲</button>
          <span id="tree-search-count" role="status" aria-live="polite" aria-atomic="true" className="w-16 min-w-[3rem] flex-shrink-0 text-center text-xs font-bold tabular-nums text-foreground sm:w-auto sm:text-sm">
            <span dir="ltr">{searchMatches.length ? searchIndex + 1 : 0} / {searchMatches.length}</span>
            <span className="sr-only">{searchQuery.trim() && !searchMatches.length ? 'لا توجد نتائج' : 'نتائج البحث'}</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigateSearch('next')}
            disabled={searchMatches.length < 2}
            className="search-step-button"
            aria-label="النتيجة التالية"
            title="النتيجة التالية"
          >▼</button>
        </div>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {isEditor && <>
            <button onClick={onOpenSettings} className="btn-base tree-toolbar-action" aria-label="الضبط">
              ⚙️ <span className="hidden lg:inline">الضبط</span>
            </button>
            <button onClick={onAddPerson} className="btn-base btn-primary tree-toolbar-action" aria-label="إضافة شخص">
              ➕ <span className="hidden lg:inline">إضافة شخص</span>
            </button>
          </>}
          {isAdmin && (
            <button onClick={onOpenAdmin} className="btn-base tree-toolbar-action relative" aria-label="الطلبات">
              🔔 {pendingCount > 0 && <span className="badge-pending">{pendingCount}</span>}
              <span className="hidden lg:inline">الطلبات</span>
            </button>
          )}

          <div className="hidden xl:block">
            <button onClick={onPrint} className="btn-base text-xs" title="طباعة الشجرة">
              🖨️ طباعة
            </button>
          </div>
          <div className={isEditor ? 'hidden lg:block' : ''}>
            <span className="stat-pill whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              {totalPersons.toLocaleString('ar-EG')} شخص
            </span>
          </div>
          <div className="hidden xl:block">
            <span className="stat-pill whitespace-nowrap">
              <span className="inline-block h-2 w-2 rounded-full bg-warning" />
              {totalBranches.toLocaleString('ar-EG')} فرع
            </span>
          </div>
        </div>
      </div>
    </div>);
}
