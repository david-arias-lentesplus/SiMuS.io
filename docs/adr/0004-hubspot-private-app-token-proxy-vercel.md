# ADR 0004 — HubSpot: Private App Token vía proxy serverless en Vercel

- **Fecha**: 2026-09-02
- **Estado**: Aceptado (Fase 2)
- **Decide**: Hermes (a partir de instrucción explícita del usuario)

## Contexto

`hermes.md` dejaba como "Pendiente de definir" el método de autenticación con HubSpot (OAuth app
vs. Private App token). El usuario activó la Fase 2 (integración real de segmentos, reemplazando
la simulación de la Fase 1) con una instrucción explícita: usar el Private App Token de HubSpot
(`HS_PAT`), y hacerlo exclusivamente desde una Serverless Function de Vercel — nunca desde el
cliente React — citando dos razones: restricciones de CORS de la API de HubSpot y protección del
token frente al navegador.

## Decisión

- **Autenticación**: Private App Token (`HS_PAT`), no OAuth app. Una Private App es suficiente
  para el caso de uso actual (lectura de listas/contactos desde un backend propio) y evita la
  complejidad de un flujo OAuth completo (redirect, refresh tokens) que no aporta nada aquí porque
  no hay múltiples cuentas de HubSpot ni un flujo de instalación por parte de terceros.
- **Ubicación del proxy**: `api/hubspot/segment.js` en la **raíz del repo** (fuera de
  `src/agents/hermes/`), porque Vercel solo detecta Serverless Functions en el directorio `api/`
  de la raíz para un proyecto Vite (no hay App Router de Next.js que permita ubicarlas en otro
  lado). La lógica de negocio real (paginación, batch read, reintentos) vive en
  `src/agents/hermes/services/hubspotService.js`; el archivo en `api/` es solo el punto de entrada
  HTTP que la invoca. Es la única excepción documentada a la regla general de "todo el código de
  un agente vive en `src/agents/<codename>/`" — está forzada por la plataforma de despliegue, no
  por una decisión de diseño del sistema de agentes.
- **Variable de entorno**: `HS_PAT` (sin prefijo `VITE_`) para que Vite nunca la incluya en el
  bundle del cliente. Se configura en Vercel (Project Settings -> Environment Variables) y
  localmente en `.env.local` (ver `.env.example`).
- **Contrato cliente-servidor**: `POST /api/hubspot/segment { listName }` -> `{ listId,
  sampleSize, contacts: [{ id, email, phone }] }`. Minerva es el único consumidor autorizado
  (`src/agents/minerva/utils/fetchSegmentFromHubSpot.js`).
- **Rate limiting**: reintentos exponenciales ante HTTP 429/5xx dentro de `hubspotService.js`,
  respetando el header `Retry-After` cuando HubSpot lo envía.

## Consecuencias

- Resuelve el punto "Pendiente de definir: método de autenticación exacto" de `hermes.md`.
- El testeo local de la ruta `/api/hubspot/segment` requiere `vercel dev` (o desplegar a Vercel);
  `vite dev` por sí solo no sirve rutas `/api/*`. Documentado en `HANDOFF.md`.
- Si en el futuro SiMuS.io necesita que HubSpot notifique cambios en tiempo real (altas/bajas de
  contactos, opt-outs) en vez de que el usuario dispare la búsqueda a demanda, hará falta un ADR
  nuevo para el mecanismo de webhooks — no cubierto por esta decisión.

## Alternativas consideradas

- **OAuth app de HubSpot**: descartada por ahora — añade complejidad de flujo de instalación y
  refresh tokens sin necesidad real, dado que SiMuS.io es una integración interna de una sola
  cuenta de HubSpot, no una app pública para terceros. Se puede revisar si el proyecto necesita
  distribuirse a otras cuentas de HubSpot en el futuro.
- **Llamar a HubSpot directamente desde el cliente**: descartada — HubSpot no habilita CORS para
  llamadas de navegador a su API REST, y expondría `HS_PAT` en el bundle de cliente.
