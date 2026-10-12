'use client';
import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import ThemeToggle from './ThemeToggle';
import type { CurrentUser } from './FamilyTreeClient';

interface Props {
  currentUser: CurrentUser | null;
  totalPersons?: number;
  onLoginClick: () => void;
  onLogout: () => void;
  onPrint: () => void;
  onFeedbackClick: () => void;
}

export default function TreeHeader({
  currentUser, totalPersons, onLoginClick, onLogout, onPrint, onFeedbackClick,
}: Props) {
  return (
    <header
      className="glass-panel no-print absolute top-0 left-0 right-0 z-30 flex h-28 flex-wrap items-center gap-x-2 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-3 sm:px-4 sm:py-0"
      style={{ direction: 'rtl' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <AppLogo size={32} />
        <div className="min-w-0">
          <span className="block truncate text-xs font-black leading-tight text-foreground sm:text-sm md:text-base">
            شجرة عائلة آل حويت
          </span>
          <span className="hidden text-xs font-medium leading-tight text-muted-foreground sm:block">
            كفر هلال 🌳 — {(totalPersons ?? 0).toLocaleString('ar-EG')} فرد
          </span>
        </div>
      </div>

      <nav aria-label="روابط وخدمات الموقع" className="order-last flex w-full items-center justify-between gap-1 sm:order-none sm:w-auto sm:justify-start sm:gap-2">
        <Link href="/about" className="btn-base min-h-11 justify-center px-3 text-sm font-bold sm:px-4">
          <span aria-hidden="true">ℹ️</span> من نحن
        </Link>
        <button type="button" onClick={onFeedbackClick} className="btn-base min-h-11 justify-center px-2 text-xs sm:px-3 sm:text-sm">
          <span aria-hidden="true" className="hidden md:inline">💬</span> تقديم مقترح أو تعليق
        </button>
        <button type="button" onClick={onPrint} aria-label="طباعة الشجرة" title="طباعة الشجرة" className="btn-base min-h-11 min-w-11 justify-center px-2 text-sm sm:px-3">
          <span aria-hidden="true">🖨️</span><span className="hidden lg:inline">طباعة</span>
        </button>
      </nav>

      <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
        <ThemeToggle />
        {currentUser ? (
          <>
            <span className="hidden text-xs font-semibold text-muted-foreground xl:block">
              {currentUser.username}
              <span className={`mr-1 role-badge ${currentUser.role === 'admin' ? 'role-admin' : 'role-supervisor'}`}>
                {currentUser.role === 'admin' ? 'مسؤول' : 'مشرف'}
              </span>
            </span>
            <Link href="/moderation-screen" aria-label="المراجعة" title="المراجعة" className="btn-base min-h-11 min-w-11 justify-center px-2 text-xs">
              <span aria-hidden="true">🛡️</span><span className="hidden xl:inline">المراجعة</span>
            </Link>
            {currentUser.role === 'admin' && (
              <Link href="/visitor-messages" aria-label="رسائل الزوار" title="رسائل الزوار" className="btn-base min-h-11 min-w-11 justify-center px-2 text-xs">
                <span aria-hidden="true">📨</span><span className="hidden xl:inline">رسائل الزوار</span>
              </Link>
            )}
            <button type="button" onClick={onLogout} className="btn-base btn-danger min-h-11 px-3 text-xs">خروج</button>
          </>
        ) : (
          <button type="button" onClick={onLoginClick} className="btn-base btn-primary min-h-11 px-3 text-xs">دخول</button>
        )}
      </div>
    </header>
  );
}
