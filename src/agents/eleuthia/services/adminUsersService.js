// Eleuthia — cliente de la API Route de invitación de usuarios
// (Fase 3, ADR 0007). Nunca llama a supabase.auth.admin.* directamente
// desde el navegador: esa API requiere el service role key de Supabase,
// que jamás debe llegar al cliente — ver api/admin/invite-user.js, el
// único punto autorizado a usarlo.
//
// @param {{email: string, role: 'admin'|'viewer', accessToken: string}} input
//   accessToken: el JWT de la sesión activa (useAuth().session.access_token)
//   — el servidor lo usa para verificar que quien invita es admin.
export async function inviteUser({ email, role, accessToken }) {
  const res = await fetch('/api/admin/invite-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ email, role }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Respuesta no-JSON (mismo caso que el resto de los clientes de /api).
  }

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status} al invitar usuario.`);
  }
  return data;
}
