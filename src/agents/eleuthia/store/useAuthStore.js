import { create } from 'zustand';
import { supabase } from '../../demeter/supabaseClient.js';
import { fetchProfile } from '../../demeter/services/profilesService.js';

// Eleuthia — único store de sesión/autenticación de la app (Fase 3,
// 2026-09-02, "AUTENTICACIÓN, CONFIGURACIÓN Y UI POLISH"). Reutiliza el
// cliente de Supabase que Deméter ya expone en
// src/agents/demeter/supabaseClient.js (regla dura de ese módulo:
// "ningún otro módulo debe importar @supabase/supabase-js directamente
// ni instanciar createClient() por su cuenta") — Eleuthia solo llama a
// supabase.auth.* sobre ese mismo cliente.
//
// Regla dura de este store (ver .claude/agents/eleuthia.md): ningún
// componente de Hefesto ni ruta de Minerva debe llamar a supabase.auth.*
// directamente; todo pasa por acá (login, logout, sesión activa, rol
// resuelto vía public.profiles).
export const useAuthStore = create((set, get) => ({
  status: 'loading', // 'loading' | 'signed-out' | 'signed-in'
  session: null,
  user: null,
  profile: null, // fila de public.profiles — incluye `role` ('admin' | 'viewer')
  authError: null,

  /**
   * Se llama una sola vez al montar la app (ver AuthGate en
   * src/agents/minerva/routes/AuthGate.jsx). Resuelve la sesión inicial
   * y se suscribe a cambios futuros (login/logout/refresh de token en
   * otra pestaña, expiración, etc.).
   */
  init: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await get()._applySession(session);

    supabase.auth.onAuthStateChange(async (_event, session) => {
      await get()._applySession(session);
    });
  },

  _applySession: async (session) => {
    if (!session) {
      set({ status: 'signed-out', session: null, user: null, profile: null });
      return;
    }
    let profile = null;
    try {
      profile = await fetchProfile(session.user.id);
    } catch (e) {
      // La sesión es válida pero no se pudo leer el perfil (red, o el
      // trigger de creación de perfil todavía no corrió tras un signup
      // recién hecho) — se trata como "rol sin resolver" en vez de
      // tumbar la sesión; los Guards de Minerva (RequireAdmin) tratan
      // profile == null como "no admin", nunca como error fatal.
      console.warn('[Eleuthia] No se pudo cargar el perfil del usuario:', e.message);
    }
    set({ status: 'signed-in', session, user: session.user, profile, authError: null });
  },

  signIn: async (email, password) => {
    set({ authError: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ authError: error.message });
      throw error;
    }
    // onAuthStateChange (suscrito en init()) actualiza session/user/profile.
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ status: 'signed-out', session: null, user: null, profile: null, authError: null });
  },
}));
