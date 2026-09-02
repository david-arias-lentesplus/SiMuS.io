import { useState } from 'react';
import SettingsLayout from './SettingsLayout.jsx';
import { useProfiles } from '../../../demeter/hooks/useProfiles.js';
import { useAuth } from '../../../eleuthia/hooks/useAuth.js';
import { inviteUser } from '../../../eleuthia/services/adminUsersService.js';

// Hefesto — /settings/users, "Gestión de Usuarios" (Fase 3, ADR 0007).
// Solo accesible para admin. Lista el equipo (useProfiles, Deméter),
// permite cambiar el rol de cada quien, e invita gente nueva vía la API
// Route de Eleuthia (api/admin/invite-user.js — el único punto con
// privilegios de servicio para crear usuarios).
export default function UsersSettingsPage() {
  const { profiles, loading, error, reload, setRole } = useProfiles();
  const { user, session } = useAuth();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteOk, setInviteOk] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError(null);
    setInviteOk(null);
    if (!inviteEmail.trim()) {
      setInviteError('Ingresa un correo.');
      return;
    }
    setInviting(true);
    try {
      await inviteUser({ email: inviteEmail.trim(), role: inviteRole, accessToken: session?.access_token });
      setInviteOk(`Invitación enviada a ${inviteEmail.trim()}.`);
      setInviteEmail('');
      await reload();
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(profile, role) {
    setBusyId(profile.id);
    try {
      await setRole(profile.id, role);
    } catch (err) {
      window.alert('Error al cambiar el rol: ' + err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SettingsLayout title="Configuración — Usuarios">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-card bg-card p-6 shadow-card lg:col-span-2">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">Equipo</h2>
          {error ? (
            <p className="text-sm text-state-danger">Error al cargar usuarios: {error.message}</p>
          ) : loading ? (
            <p className="text-sm text-ink-400">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-300/40 text-xs uppercase tracking-wide text-ink-500">
                    <th className="py-2 pr-3">Correo</th>
                    <th className="py-2 pr-3">Rol</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b border-ink-300/20 last:border-0">
                      <td className="py-2 pr-3 font-medium text-ink-900">
                        {p.email} {p.id === user?.id ? <span className="text-xs text-ink-400">(tú)</span> : null}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            p.role === 'admin' ? 'bg-blue-deep/10 text-blue-deep' : 'bg-surface text-ink-700'
                          }`}
                        >
                          {p.role}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <select
                          value={p.role}
                          disabled={busyId === p.id || p.id === user?.id}
                          onChange={(e) => handleRoleChange(p, e.target.value)}
                          title={p.id === user?.id ? 'No puedes cambiar tu propio rol' : undefined}
                          className="rounded-lg border border-ink-300/60 bg-surface px-2 py-1 text-xs text-ink-900 disabled:opacity-50"
                        >
                          <option value="admin">admin</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form onSubmit={handleInvite} className="h-fit rounded-card bg-card p-6 shadow-card">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-500">Invitar usuario</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-500">Correo</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none"
                placeholder="nuevo@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500">Rol</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink-300/60 bg-surface px-3 py-2 text-sm text-ink-900 focus:border-brand-teal focus:outline-none"
              >
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          {inviteError ? <p className="mt-3 text-xs text-state-danger">{inviteError}</p> : null}
          {inviteOk ? <p className="mt-3 text-xs text-state-success">{inviteOk}</p> : null}
          <button
            type="submit"
            disabled={inviting}
            className="mt-4 w-full rounded-lg bg-blue-deep px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {inviting ? 'Enviando...' : 'Enviar invitación'}
          </button>
          <p className="mt-2 text-xs text-ink-400">
            Se envía un correo de invitación de Supabase Auth; el usuario queda con el rol elegido apenas la acepta.
          </p>
        </form>
      </div>
    </SettingsLayout>
  );
}
