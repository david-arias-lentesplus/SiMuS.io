import { createClient } from '@supabase/supabase-js';

// Eleuthia — SOLO SERVIDOR (Fase 3, ADR 0007). Invita un usuario nuevo
// vía Supabase Auth Admin API y le asigna un rol en public.profiles.
// Requiere el SERVICE ROLE KEY de Supabase (nunca el anon key): la API
// `auth.admin.inviteUserByEmail` solo existe con privilegios de
// servicio. Igual patrón que HS_PAT/METABASE_MCP_KEY (ver ADR 0004/0006):
// SUPABASE_SERVICE_ROLE_KEY nunca lleva prefijo VITE_, nunca tiene
// entrada en `define` de vite.config.js, y solo se lee acá vía
// process.env — si algún día alguien la agrega a vite.config.js por
// error, quedaría expuesta al navegador.
//
// Autorización: el caller debe estar autenticado Y tener role='admin' en
// public.profiles. Se valida leyendo el JWT del header Authorization con
// el propio cliente de servicio (auth.getUser(token)) y verificando el
// rol en profiles — nunca se confía en un rol que venga del body del
// request (el body solo trae el rol que se le va a ASIGNAR al invitado,
// no el rol de quien invita).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido, usa POST.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados en el entorno del servidor.',
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Falta el token de sesión (Authorization: Bearer ...).' });
  }

  const { email, role } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: '"email" es obligatorio y debe ser un correo válido.' });
  }
  if (role !== 'admin' && role !== 'viewer') {
    return res.status(400).json({ error: '"role" debe ser "admin" o "viewer".' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verifica que el token pertenezca a una sesión real y vigente.
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData?.user) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }

  // Verifica que quien invita sea admin (nunca se confía en el cliente).
  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle();
  if (profileError) {
    return res.status(500).json({ error: 'No se pudo verificar el rol del usuario que invita.' });
  }
  if (callerProfile?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede invitar usuarios.' });
  }

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
  if (inviteError) {
    return res.status(502).json({ error: `Error al invitar: ${inviteError.message}` });
  }

  // El trigger on_auth_user_created (migración 002) ya insertó la fila en
  // profiles con role='viewer' por defecto al crearse el usuario invitado
  // — acá se ajusta al rol elegido en el formulario si es distinto.
  if (invited?.user?.id) {
    await supabaseAdmin
      .from('profiles')
      .update({ role, email })
      .eq('id', invited.user.id);
  }

  return res.status(200).json({ ok: true, userId: invited?.user?.id ?? null });
}
