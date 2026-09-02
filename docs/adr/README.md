# Architecture Decision Records (ADR)

Registro de decisiones de arquitectura relevantes o irreversibles del proyecto SiMuS.io. Mantenido por Apolo.

## Convención
- Archivo por decisión: `NNNN-titulo-en-kebab-case.md`, numeración secuencial de 4 dígitos.
- Una decisión ya tomada no se edita retroactivamente para cambiar su contenido: si se revierte o reemplaza, se crea un nuevo ADR que referencia al anterior y se marca el viejo como "Superseded".
- Plantilla mínima: Contexto, Decisión, Consecuencias, Alternativas consideradas.

## Índice
- [0001 — Adopción del sistema de agentes especializados](0001-adopcion-sistema-de-agentes.md)
- [0002 — Supabase como persistencia central](0002-supabase-como-persistencia-central.md)

- [0003 — Stack de frontend: React + Vite + Tailwind + Zustand](0003-stack-frontend-react-vite-tailwind-zustand.md)
- [0004 — HubSpot: Private App Token vía proxy serverless en Vercel](0004-hubspot-private-app-token-proxy-vercel.md)
- [0005 — Variables de entorno del cliente sin prefijo VITE_](0005-env-vars-sin-prefijo-vite.md)
