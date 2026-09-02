# src/agents/hermes/

Carpeta de código propio del agente **hermes**. Ver definición de rol, responsabilidades y reglas
en `.claude/agents/hermes.md`.

## Código (desde Fase 2, sesión 2026-09-02)

- `services/hubspotService.js` — SOLO SERVIDOR. Toda la lógica de comunicación con la API de
  HubSpot (auth con Private App Token, paginación de listas, batch read de contactos, reintentos
  ante rate limit). Nunca se importa desde código de cliente (Hefesto/Minerva); el único
  consumidor autorizado es `/api/hubspot/segment.js` en la raíz del repo.

Por qué el endpoint HTTP vive fuera de esta carpeta: Vercel detecta Serverless Functions
exclusivamente en el directorio `api/` de la raíz del proyecto (requisito de la plataforma, no de
este sistema de agentes) — ver ADR 0004. La lógica de negocio de Hermes sí vive 100% aquí; `api/`
solo contiene el punto de entrada HTTP que llama a estas funciones.

Pendiente: ver "Pendiente de definir" en `.claude/agents/hermes.md`.
