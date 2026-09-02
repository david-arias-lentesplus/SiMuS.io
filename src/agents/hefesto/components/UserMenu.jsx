import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../eleuthia/hooks/useAuth.js';

// Hefesto — UserMenu (Fase 3, ADR 0007). Reemplaza el círculo gris vacío
// del Topbar: iniciales del usuario logueado, su rol, y un menú con
// "Configuración" (solo si es admin) y "Cerrar sesión". Consume
// exclusivamente el hook de sesión de Eleuthia (useAuth) — nunca toca
// supabase.auth.* directo (regla dura de Eleuthia).
export default function UserMenu() {
  const { user, role, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!user) {
    // AuthGate/RequireAuth ya deberían impedir que el Topbar se monte sin
    // sesión, pero se deja el placeholder original como red de seguridad.
    return <div className="h-9 w-9 rounded-full bg-surface" aria-hidden="true" />;
  }

  const initials = initialsFromEmail(user.email);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-deep text-xs font-semibold text-white"
        title={`${user.email} (${role ?? 'sin rol'})`}
      >
        {initials}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-10 w-56 rounded-card bg-card p-2 shadow-card">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-ink-900">{user.email}</p>
            <p className="text-xs text-ink-400">Rol: {role ?? '—'}</p>
          </div>
          <div className="my-1 h-px bg-ink-300/30" />
          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/settings/countries');
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-surface"
            >
              Configuración
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-state-danger hover:bg-state-danger/10"
          >
            Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}

function initialsFromEmail(email) {
  if (!email) return '?';
  const namePart = email.split('@')[0];
  const pieces = namePart.split(/[._-]/).filter(Boolean);
  const letters = pieces.length > 1 ? pieces[0][0] + pieces[1][0] : namePart.slice(0, 2);
  return letters.toUpperCase();
}
