import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../eleuthia/hooks/useAuth.js';

// Hefesto — pantalla de Login (Fase 3, ADR 0007). Único punto de entrada
// público de la app. Presentacional + estado local del formulario; el
// flujo real de autenticación vive en Eleuthia (useAuth().signIn).
export default function LoginPage() {
  const { isAuthenticated, signIn, authError } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  if (isAuthenticated) {
    const to = location.state?.from?.pathname || '/';
    return <Navigate to={to} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setLocalError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-card bg-card p-8 shadow-card">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-sidebar-from to-sidebar-to">
            <BoltIcon />
          </div>
          <h1 className="text-lg font-semibold text-ink-900">SiMuS.io</h1>
          <p className="text-xs text-ink-400">Ingresa con tu cuenta del equipo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-500">Correo</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
              placeholder="tu@empresa.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500">Contraseña</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-teal focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {localError || authError ? (
            <p className="text-xs text-state-danger">{localError || authError}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-deep px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-400">
          ¿No tienes cuenta? Pídele a un administrador que te invite desde Configuración → Usuarios.
        </p>
      </div>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
