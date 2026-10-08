'use client';
import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import type { CurrentUser } from './FamilyTreeClient';

interface Props {
  currentUser: CurrentUser | null;
  searchQuery: string;
  searchMatches: string[];
  searchIndex: number;
  totalPersons?: number;
  onSearch: (q: string) => void;
  onNavigateSearch: (dir: 'prev' | 'next') => void;
  onLoginClick: () => void;
  onLogout: () => void;
  onPrint: () => void;
}

export default function TreeHeader({
  currentUser, searchQuery, searchMatches, searchIndex,
  totalPersons,
  onSearch, onNavigateSearch, onLoginClick, onLogout, onPrint
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const count = totalPersons ?? 2214;

  return (
    <>
      {/* ── Print-only info card ── */}
      <div
        className="print-only"
        style={{
          display: 'none',
          direction: 'rtl',
          textAlign: 'center',
          padding: '20px 24px 14px',
          background: '#0f172a',
          borderBottom: '3px solid #c8a84b',
          fontFamily: "'Tajawal', 'Amiri', sans-serif",
          color: '#f1f5f9',
          pageBreakAfter: 'avoid',
          width: '100%',
        }}
      >
        <div style={{ fontSize: '24px', fontWeight: 900, color: '#f0d080', letterSpacing: '0.04em', marginBottom: '8px' }}>
          شجرة عائلة آل حويت بكفر هلال
        </div>
        <div style={{ fontSize: '15px', color: '#94a3b8', marginBottom: '6px' }}>
          إجمالي أفراد العائلة: <strong style={{ color: '#f0d080' }}>{count.toLocaleString('ar-EG')}</strong> فرد
        </div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          تم التطوير وجمع البيانات بواسطة: م. مجدي حويت &amp; م. عبداللطيف حويت
        </div>
      </div>

      <header
        className="glass-panel no-print absolute top-0 left-0 right-0 z-30 h-14 flex items-center px-4 gap-3 border-b-0"
        style={{ direction: 'rtl' }}>

        {/* Logo + Title + Info Badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <AppLogo size={32} />
          <div className="hidden sm:block">
            <span className="font-sans font-black text-sm md:text-base text-foreground leading-tight block">
              شجرة عائلة آل حويت
            </span>
            <span className="text-xs font-medium text-muted-foreground leading-tight block">
              كفر هلال 🌳 — {count.toLocaleString('ar-EG')} فرد
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 flex items-center gap-2 max-w-xl mx-auto">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              onKeyDown={(e) => {if (e.key === 'Enter') onSearch(searchQuery);}}
              placeholder="ابحث بالاسم واضغط Enter..."
              className="custom-input pr-4 pl-4 h-9 text-sm w-full"
              style={{ direction: 'rtl' }} />
          </div>
          {searchMatches.length > 0 &&
          <div className="search-nav-bar flex-shrink-0">
              <button
              onClick={() => onNavigateSearch('prev')}
              className="hover:opacity-70 transition-opacity px-1"
              aria-label="نتيجة سابقة">
                ▶
              </button>
              <span className="tabular-nums text-xs font-black">
                {searchIndex + 1}/{searchMatches.length}
              </span>
              <button
              onClick={() => onNavigateSearch('next')}
              className="hover:opacity-70 transition-opacity px-1"
              aria-label="نتيجة تالية">
                ◀
              </button>
            </div>
          }
        </div>

        {/* User status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onPrint} className="btn-base text-xs px-3 py-1.5 no-print flex items-center gap-1">
            🖨️ <span>طباعه</span>
          </button>
          {currentUser ?
          <>
              <span className="text-xs font-semibold text-muted-foreground hidden md:block">
                {currentUser.username}
                <span className={`mr-1 role-badge ${currentUser.role === 'admin' ? 'role-admin' : 'role-supervisor'}`}>
                  {currentUser.role === 'admin' ? 'مسؤول' : 'مشرف'}
                </span>
              </span>
              <Link href="/moderation-screen" className="btn-base text-xs px-3 py-1.5 hidden sm:inline-flex items-center gap-1">
                🛡️ المراجعة
              </Link>
              <button onClick={onLogout} className="btn-base btn-danger text-xs px-3 py-1.5">
                خروج
              </button>
            </> :
          <button onClick={onLoginClick} className="btn-base btn-primary text-xs px-3 py-1.5">
              دخول
            </button>
          }
        </div>
      </header>
    </>
  );
}