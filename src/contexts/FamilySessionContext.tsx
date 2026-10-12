'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getPermissions,
  type CurrentUser,
  type SupervisorPermissions,
} from '@/lib/familyPermissions';
import {
  authenticateSupervisor,
  fetchSupervisorSession,
  SUPERVISORS_CHANGED_KEY,
  type Supervisor,
} from '@/lib/supervisorService';
import { createClient } from '@/lib/supabase/client';

const SESSION_KEY = 'fam_current_user';

interface FamilySessionValue {
  currentUser: CurrentUser | null;
  permissions: SupervisorPermissions;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const FamilySessionContext = createContext<FamilySessionValue | undefined>(undefined);

function supervisorUser(supervisor: Supervisor): CurrentUser {
  return {
    username: supervisor.username,
    role: 'supervisor',
    supervisorId: supervisor.id,
    can_edit: supervisor.can_edit === true,
    can_delete: supervisor.can_delete === true,
    can_moderate: supervisor.can_moderate === true,
    can_style: supervisor.can_style === true,
  };
}

export function FamilySessionProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<CurrentUser | null>(null);
  const generationRef = useRef(0);

  const applyUser = useCallback((user: CurrentUser | null) => {
    userRef.current = user;
    setCurrentUser(user);
    if (user) {
      const serialized = JSON.stringify(user);
      if (localStorage.getItem(SESSION_KEY) !== serialized)
        localStorage.setItem(SESSION_KEY, serialized);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const generation = ++generationRef.current;
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      const identity: unknown = saved ? JSON.parse(saved) : null;
      if (
        !identity ||
        typeof identity !== 'object' ||
        !('username' in identity) ||
        typeof identity.username !== 'string' ||
        !('role' in identity)
      ) {
        applyUser(null);
        return;
      }
      if (identity.role === 'admin') {
        applyUser({ username: identity.username, role: 'admin' });
        return;
      }
      if (identity.role !== 'supervisor') {
        applyUser(null);
        return;
      }
      const supervisorId =
        'supervisorId' in identity &&
        (typeof identity.supervisorId === 'string' || typeof identity.supervisorId === 'number')
          ? identity.supervisorId
          : undefined;
      const supervisor = await fetchSupervisorSession({
        username: identity.username,
        supervisorId,
      });
      if (generation === generationRef.current)
        applyUser(supervisor ? supervisorUser(supervisor) : null);
    } catch {
      // Never grant permissions from a stale local snapshot when validation fails.
      if (generation === generationRef.current) {
        const user = userRef.current;
        if (user?.role === 'supervisor')
          applyUser({
            ...user,
            can_edit: false,
            can_delete: false,
            can_moderate: false,
            can_style: false,
          });
        else setCurrentUser(null);
      }
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [applyUser]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const generation = ++generationRef.current;
      const normalizedUsername = username.trim();
      const adminResponse = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ username: normalizedUsername, password }),
      }).catch(() => {
        throw new Error('تعذر تسجيل الدخول، تحقق من اتصالك وحاول مرة أخرى');
      });
      if (!adminResponse.ok && adminResponse.status !== 401) {
        throw new Error('تعذر تسجيل الدخول، حاول مرة أخرى');
      }
      let user: CurrentUser;
      if (adminResponse.ok && (await adminResponse.json()).authenticated === true) {
        user = { username: normalizedUsername, role: 'admin' };
      } else {
        const supervisor = await authenticateSupervisor(normalizedUsername, password);
        if (!supervisor) throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة');
        user = supervisorUser(supervisor);
      }
      if (generation === generationRef.current) {
        applyUser(user);
        setLoading(false);
      }
    },
    [applyUser]
  );

  const signOut = useCallback(() => {
    ++generationRef.current;
    applyUser(null);
    setLoading(false);
  }, [applyUser]);

  useEffect(() => {
    void refreshSession();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY || event.key === SUPERVISORS_CHANGED_KEY || event.key === null)
        void refreshSession();
    };
    const handleRefresh = () => {
      void refreshSession();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refreshSession();
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleRefresh);
    window.addEventListener(SUPERVISORS_CHANGED_KEY, handleRefresh);
    document.addEventListener('visibilitychange', handleVisibility);
    const timer = window.setInterval(() => {
      if (userRef.current?.role === 'supervisor' && document.visibilityState === 'visible')
        void refreshSession();
    }, 30000);
    return () => {
      ++generationRef.current;
      window.clearInterval(timer);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleRefresh);
      window.removeEventListener(SUPERVISORS_CHANGED_KEY, handleRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshSession]);

  const supervisorId = currentUser?.role === 'supervisor' ? currentUser.supervisorId : null;
  useEffect(() => {
    if (supervisorId === null) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`supervisor-permissions:${supervisorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supervisors' }, () => {
        void refreshSession();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supervisorId, refreshSession]);

  return (
    <FamilySessionContext.Provider
      value={{ currentUser, permissions: getPermissions(currentUser), loading, signIn, signOut }}
    >
      {children}
    </FamilySessionContext.Provider>
  );
}

export function useFamilySession() {
  const context = useContext(FamilySessionContext);
  if (!context) throw new Error('useFamilySession must be used within FamilySessionProvider');
  return context;
}
