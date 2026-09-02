# ADR 0003 — Stack de frontend: React + Vite + Tailwind + Zustand

- **Fecha**: 2026-09-01
- **Estado**: Aceptado (Fase 1)
- **Decide**: Hefesto + Minerva (a partir de instrucción explícita del usuario)

## Contexto

`HANDOFF.md` y los archivos de agente (`hefesto.md`, `minerva.md`) dejaban
el framework de frontend como "asumido Next.js + Tailwind por el despliegue
en Vercel, sujeto a confirmación", junto con la librería de estado global
sin decidir.

Al iniciar la Fase 1, el usuario especificó explícitamente: "plataforma en
entorno **React** (para desplegar en Vercel)".

## Decisión

- **Framework**: React 18 sobre **Vite** (no Next.js). Vite se despliega en
  Vercel igual de bien que Next.js para una SPA y evita features de Next
  (SSR/rutas de servidor) que este proyecto no necesita en Fase 1.
- **Enrutamiento**: `react-router-dom` (rutas 100% de cliente).
- **Estilos**: Tailwind CSS, tokens centralizados en `tailwind.config.js`
  (dominio exclusivo de Hefesto).
- **Estado global**: Zustand (`src/agents/minerva/store/`), coincide con el
  patrón ya usado en Proyecto Faro según `AGENTS_SYSTEM_HANDOFF.md`.
- **Gráficas**: Chart.js vía `react-chartjs-2` (agregado a `package.json`;
  implementación real pendiente, ver README de Hefesto).
- **Datos**: `@supabase/supabase-js`, encapsulado exclusivamente en
  `src/agents/demeter/`.

## Consecuencias

- Se resuelve el punto "Pendiente de definir" de framework en
  `hefesto.md` y `minerva.md` para Fase 1.
- Si una fase futura requiere SSR/SEO real (ej. páginas públicas
  indexables), esta decisión debería revisarse con un nuevo ADR.
