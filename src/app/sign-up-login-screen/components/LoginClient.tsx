'use client';
import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { SYSTEM_USERS } from '@/lib/familyData';
import { Toaster, toast } from 'sonner';

interface FormData { username: string; password: string; }

const DEMO_ACCOUNTS = [
  { role: 'مسؤول' as const, username: 'magwait', password: '@mg2208!QAZ', desc: 'صلاحيات كاملة' },
  { role: 'مشرف' as const, username: 'lateef74', password: '@LAT12345678', desc: 'إرسال طلبات' },
  { role: 'مشرف' as const, username: 'hewait18', password: '@MAG12345678', desc: 'إرسال طلبات' },
  { role: 'مشرف' as const, username: 'hewait20', password: '@MAG12345678', desc: 'إرسال طلبات' },
];

const STATS = [
  { label: 'إجمالي الأفراد', value: '2,214', icon: '👥' },
  { label: 'الفروع العائلية', value: '15', icon: '🌿' },
  { label: 'أجيال موثقة', value: '8+', icon: '📜' },
  { label: 'سنة البداية', value: '1885', icon: '📅' },
];

export default function LoginClient() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>();

  const onSubmit = useCallback((data: FormData) => {
    const user = SYSTEM_USERS[data.username];
    if (user && user.pass === data.password) {
      localStorage.setItem('fam_current_user', JSON.stringify({ username: data.username, role: user.role }));
      toast.success(`مرحباً ${data.username}`);
      setTimeout(() => router.push('/'), 800);
    } else {
      setLoginError('بيانات الدخول غير صحيحة — استخدم أحد الحسابات التجريبية أدناه للدخول');
    }
  }, [router]);

  const autofill = useCallback((username: string, password: string) => {
    setValue('username', username);
    setValue('password', password);
    setLoginError('');
  }, [setValue]);

  return (
    <div
      className="min-h-screen flex bg-default-canvas"
      style={{ direction: 'rtl', fontFamily: 'var(--font-sans)' }}
    >
      {/* Left — Brand Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] p-10 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-gold/5 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <AppLogo size={44} />
          <div>
            <span className="block font-black text-xl text-foreground">شجرة حويت</span>
            <span className="block text-sm font-medium text-muted-foreground">كفر هلال — منذ 1885</span>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-8">
          {/* Tree illustration */}
          <div className="flex justify-center">
            <svg width="280" height="220" viewBox="0 0 280 220" style={{ direction: 'ltr' }}>
              <defs>
                <radialGradient id="rootGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#e1d019" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#e1d019" stopOpacity="0" />
                </radialGradient>
              </defs>
              {/* Root glow */}
              <circle cx="140" cy="30" r="40" fill="url(#rootGlow)" />
              {/* Root node */}
              <rect x="110" y="18" width="60" height="24" rx="12" fill="#e1d019" />
              <text x="140" y="32" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="900" fill="#0f172a" fontFamily="Tajawal">حويت</text>
              {/* Level 2 edges */}
              {[60, 140, 220].map((x, i) => (
                <React.Fragment key={`branch-${i}`}>
                  <path d={`M 140 42 C 140 65, ${x} 65, ${x} 80`} stroke="#ddb892" strokeWidth="1.5" fill="none" strokeDasharray={i === 1 ? 'none' : 'none'} />
                  <rect x={x - 30} y="80" width="60" height="20" rx="10" fill="#add7a0" />
                  <text x={x} y="91" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="700" fill="#0f172a" fontFamily="Tajawal">
                    {['أحمد', 'موسى', 'حسين'][i]}
                  </text>
                </React.Fragment>
              ))}
              {/* Level 3 */}
              {[30, 80, 110, 170, 200, 250].map((x, i) => {
                const parentX = [60, 60, 140, 140, 220, 220][i];
                const colors = ['#add7a0', '#fcd9d9', '#add7a0', '#fcd9d9', '#add7a0', '#fcd9d9'];
                return (
                  <React.Fragment key={`l3-${i}`}>
                    <path d={`M ${parentX} 100 C ${parentX} 120, ${x} 120, ${x} 135`} stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
                    <ellipse cx={x} cy="143" rx="22" ry="10" fill={colors[i]} />
                  </React.Fragment>
                );
              })}
              {/* Level 4 dots */}
              {[20, 50, 100, 130, 160, 190, 220, 260].map((x, i) => (
                <circle key={`l4-${i}`} cx={x} cy="175" r="6" fill={i % 2 === 0 ? '#add7a0' : '#fcd9d9'} opacity="0.7" />
              ))}
              {/* Generation labels */}
              <text x="8" y="32" fontSize="8" fill="rgba(255,255,255,0.3)" fontFamily="Tajawal">ج١</text>
              <text x="8" y="92" fontSize="8" fill="rgba(255,255,255,0.3)" fontFamily="Tajawal">ج٢</text>
              <text x="8" y="145" fontSize="8" fill="rgba(255,255,255,0.3)" fontFamily="Tajawal">ج٣</text>
              <text x="8" y="178" fontSize="8" fill="rgba(255,255,255,0.3)" fontFamily="Tajawal">ج٤</text>
            </svg>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black text-foreground leading-tight">
              شجرة نسب عائلة ال حويت
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
              سجل تاريخي تفاعلي لنسب عائلة ال حويت بكفر هلال — موثق عبر الأجيال منذ عام 1885
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((stat) => (
              <div key={`stat-${stat.label}`} className="glass rounded-xl p-4 text-center">
                <div className="text-2xl mb-1">{stat.icon}</div>
                <div className="text-xl font-black text-primary tabular-nums">{stat.value}</div>
                <div className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/50 relative z-10 text-center">
          © 2026 شجرة حويت — كفر هلال، محافظة كفر الشيخ
        </p>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 lg:px-12 max-w-lg mx-auto lg:mx-0 w-full">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <AppLogo size={36} />
          <span className="font-black text-lg text-foreground">شجرة حويت</span>
        </div>

        <div className="glass rounded-2xl p-8 w-full">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-foreground">تسجيل الدخول</h2>
            <p className="text-sm text-muted-foreground mt-1">
              للمشرفين والمسؤولين فقط — الزوار يمكنهم التصفح بدون دخول
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="settings-label">اسم المستخدم *</label>
              <input
                type="text"
                autoComplete="username"
                className="custom-input"
                placeholder="أدخل اسم المستخدم"
                {...register('username', { required: 'اسم المستخدم مطلوب' })}
              />
              {errors.username && (
                <p className="text-danger text-xs mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="settings-label">كلمة المرور *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="custom-input pl-10"
                  placeholder="أدخل كلمة المرور"
                  {...register('password', { required: 'كلمة المرور مطلوبة' })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPass ? (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-danger text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {loginError && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-danger text-sm leading-relaxed">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-base btn-primary w-full justify-center text-base py-3 mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  جارٍ الدخول...
                </span>
              ) : 'دخول إلى الشجرة'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn-base w-full justify-center text-sm text-muted-foreground hover:text-foreground"
            >
              تصفح كزائر بدون دخول ←
            </button>
          </form>
        </div>

        {/* Demo Credentials Table — hidden */}
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(15,23,42,0.98)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#e2e8f0',
            fontFamily: 'Tajawal, sans-serif',
            direction: 'rtl',
          },
        }}
      />
    </div>
  );
}