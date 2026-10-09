'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

interface Props {
  onLogin: (username: string, password: string) => boolean;
  onClose: () => void;
}

interface FormData { username: string; password: string; }

const DEMO_ACCOUNTS = [
  { role: 'مسؤول', username: 'magwait', password: '@mg2208!QAZ' },
  { role: 'مشرف', username: 'lateef74', password: '@LAT12345678' },
  { role: 'مشرف', username: 'hewait18', password: '@MAG12345678' },
  { role: 'مشرف', username: 'hewait20', password: '@MAG12345678' },
];

export default function AuthModal({ onLogin, onClose }: Props) {
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>();

  const onSubmit = (data: FormData) => {
    const ok = onLogin(data.username, data.password);
    if (ok) { onClose(); }
    else { setLoginError('بيانات الدخول غير صحيحة — استخدم أحد الحسابات التجريبية أدناه'); }
  };

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-modal modal-enter w-full max-w-md mx-4 p-8 max-h-[90vh] overflow-y-auto" style={{ direction: 'rtl' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-foreground">تسجيل الدخول</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="settings-label">اسم المستخدم *</label>
            <input
              type="text"
              className="custom-input"
              placeholder="أدخل اسم المستخدم"
              {...register('username', { required: 'اسم المستخدم مطلوب' })}
            />
            {errors.username && <p className="text-danger text-xs mt-1">{errors.username.message}</p>}
          </div>

          <div>
            <label className="settings-label">كلمة المرور *</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="custom-input pl-10"
                placeholder="أدخل كلمة المرور"
                {...register('password', { required: 'كلمة المرور مطلوبة' })}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
          </div>

          {loginError && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-base btn-primary w-full justify-center text-base py-3"
          >
            {isSubmitting ? '...' : 'دخول'}
          </button>
        </form>

      </div>
    </div>
  );
}