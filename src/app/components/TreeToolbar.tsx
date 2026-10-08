'use client';
import React, { useRef } from 'react';
import type { CurrentUser } from './FamilyTreeClient';
import type { Person } from '@/lib/familyData';

interface Props {
  currentUser: CurrentUser | null;
  pendingCount: number;
  onAddPerson: () => void;
  onOpenAdmin: () => void;
  onImport: (data: Person[], merge: boolean) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onOpenSettings: () => void;
  onPrint?: () => void;
}

export default function TreeToolbar({
  currentUser, pendingCount,
  onAddPerson, onOpenAdmin,
  onOpenSettings, onPrint,
}: Props) {
  const isEditor = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div
      className="glass-panel no-print absolute top-14 left-0 right-0 z-20 h-12 flex items-center px-4 gap-2 overflow-x-auto"
      style={{ direction: 'rtl' }}>

      {/* Decorative credit text */}
      <p
        className="flex-shrink-0 hidden sm:block text-sm font-semibold"
        style={{
          fontFamily: "'Amiri', 'Scheherazade New', 'Noto Naskh Arabic', serif",
          background: 'linear-gradient(90deg, #c8a84b, #f0d080, #c8a84b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontWeight: 700,
          letterSpacing: '0.02em',
          textShadow: 'none',
          fontSize: '0.72rem'
        }}>
        ✦ تم التطوير وجمع البيانات بواسطة أبناء العائلة م. عبداللطيف حويت وم. مجدي حويت ✦
      </p>

      {isEditor &&
      <>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={onOpenSettings} className="btn-base text-xs">
            ⚙️ <span className="hidden sm:inline">الضبط</span>
          </button>
          <button onClick={onAddPerson} className="btn-base btn-primary text-xs">
            ➕ <span className="hidden sm:inline">إضافة شخص</span>
          </button>
        </>
      }

      {isAdmin &&
      <>
          <div className="w-px h-6 bg-white/10 mx-1" />
          <button onClick={onOpenAdmin} className="btn-base text-xs relative">
            🔔
            {pendingCount > 0 &&
          <span className="badge-pending">{pendingCount}</span>
          }
            <span className="hidden sm:inline">الطلبات</span>
          </button>
        </>
      }

      {/* Stats pills */}
      <div className="mr-auto flex items-center gap-2 flex-shrink-0">
        <button onClick={onPrint} className="btn-base text-xs" title="طباعة الشجرة">
          🖨️ <span className="hidden sm:inline">طباعة</span>
        </button>
        <span className="stat-pill">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          2,214 شخص
        </span>
        <span className="stat-pill hidden md:inline-flex">
          <span className="w-2 h-2 rounded-full bg-warning inline-block" />
          15 فرع
        </span>
      </div>
    </div>);
}