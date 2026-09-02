import { useEffect } from 'react';
import { useAuthStore } from '../../eleuthia/store/useAuthStore.js';

// Minerva — arranca la resolución de sesión de Eleuthia una única vez al
// montar la app y bloquea el render hasta saber si hay sesión o no
// (evita el parpadeo de "pantalla de login" -> "dashboard" mientras se
// resuelve la sesión guardada). Ver App.jsx.
let didInit = false;

export default function AuthGate({ children }) {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (didInit) return;
    didInit = true;
    useAuthStore.getState().init();
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface text-sm text-ink-400">
        Cargando sesión...
      </div>
    );
  }
  return children;
}
