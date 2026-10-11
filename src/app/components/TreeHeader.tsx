'use client';
import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import type { CurrentUser } from './FamilyTreeClient';

interface Props {
  currentUser: CurrentUser | null;
  totalPersons?: number;
  onLoginClick: () => void;
  onLogout: () => void;
  onPrint: () => void;
}

export default function TreeHeader({
  currentUser,
  totalPersons,
  onLoginClick, onLogout, onPrint
}: Props) {
  const count = totalPersons ?? 0;

  return (
    <>
      <header
        className="glass-panel no-print absolute top-0 left-0 right-0 z-30 h-14 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 border-b-0"
        style={{ direction: 'rtl' }}>

        {/* Logo + Title + Info Badge */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AppLogo size={32} />
          <div className="min-w-0">
            <span className="font-sans font-black text-xs sm:text-sm md:text-base text-foreground leading-tight block truncate">
              شجرة عائلة آل حويت
            </span>
            <span className="text-xs font-medium text-muted-foreground leading-tight hidden sm:block">
              كفر هلال 🌳 — {count.toLocaleString('ar-EG')} فرد
            </span>
          </div>
        </div>

        {/* User status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/about" aria-label="من نحن" className="btn-base text-xs px-2 sm:px-3 py-1.5 no-print inline-flex items-center gap-1">
            ℹ️ <span className="hidden sm:inline">من نحن</span>
          </Link>
          <button onClick={onPrint} aria-label="طباعة الشجرة" className="btn-base text-xs px-2 sm:px-3 py-1.5 no-print flex items-center gap-1">
            🖨️ <span className="hidden sm:inline">طباعة</span>
          </button>
          {currentUser ?
          <>
              <span className="text-xs font-semibold text-muted-foreground hidden md:block">
                {currentUser.username}
                <span className={`mr-1 role-badge ${currentUser.role === 'admin' ? 'role-admin' : 'role-supervisor'}`}>
                  {currentUser.role === 'admin' ? 'مسؤول' : 'مشرف'}
                </span>
              </span>
              <span className="hidden sm:block">
                <Link href="/moderation-screen" className="btn-base text-xs px-3 py-1.5 inline-flex items-center gap-1">
                  🛡️ المراجعة
                </Link>
              </span>
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
