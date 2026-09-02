import { useAuthStore } from '../store/useAuthStore.js';

// Eleuthia — hook de conveniencia: Hefesto/Minerva consumen esto, nunca
// leen campos crudos del store ni conocen los valores exactos de `role`
// en public.profiles (aíslan la matriz de roles en un único lugar, ver
// .claude/agents/eleuthia.md).
export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const authError = useAuthStore((s) => s.authError);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);

  const role = profile?.role ?? null;

  return {
    loading: status === 'loading',
    isAuthenticated: status === 'signed-in',
    session,
    user,
    profile,
    role,
    isAdmin: role === 'admin',
    isViewer: role === 'viewer',
    authError,
    signIn,
    signOut,
  };
}
