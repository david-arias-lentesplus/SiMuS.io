# SiMuS.io

Plataforma para extraer, consolidar y analizar las métricas de envío de SMS, integrando **HubSpot** (fuente de verdad de clientes) y **Workingbits** (proveedor y gateway de envío) para generar trazabilidad permanente de cada mensaje.

## Objetivo principal

Superar la limitación de 90 días de retención de datos de Workingbits, persistiendo cada registro de envío de forma permanente en una base de datos propia, y ofrecer un dashboard de analítica sobre esas métricas.

## Arquitectura de datos

- **Supabase** — base de datos central y persistente del sistema.
- **HubSpot** — fuente de verdad de la base de clientes.
- **Workingbits** — proveedor y gateway de envío de SMS (retención de solo 90 días; de ahí la necesidad de extraer y persistir en Supabase).

## Infraestructura

- **Control de versiones**: GitHub.
- **Hosting/Despliegue**: Vercel.

## Sistema de agentes

El desarrollo de este proyecto está gobernado por un sistema de 9 agentes especializados, cada uno con dominio exclusivo, definidos en `.claude/agents/`. El patrón general (reutilizable en otros proyectos) está documentado en `AGENTS_SYSTEM_HANDOFF.md`; su aplicación concreta a SiMuS.io se documenta en `docs/adr/0001-adopcion-sistema-de-agentes.md`.

| Agente | Dominio | Definición |
|---|---|---|
| Hermes | Integración con HubSpot (clientes) | [`.claude/agents/hermes.md`](.claude/agents/hermes.md) |
| Iris | Integración con Workingbits (envío y extracción de eventos SMS) | [`.claude/agents/iris.md`](.claude/agents/iris.md) |
| Deméter | Persistencia en Supabase | [`.claude/agents/demeter.md`](.claude/agents/demeter.md) |
| Hefesto | UX/UI del dashboard | [`.claude/agents/hefesto.md`](.claude/agents/hefesto.md) |
| Minerva | Rutas y estado global | [`.claude/agents/minerva.md`](.claude/agents/minerva.md) |
| Eleuthia | Autenticación y roles del equipo interno | [`.claude/agents/eleuthia.md`](.claude/agents/eleuthia.md) |
| HADES | QA/Testing (autoridad de veto) | [`.claude/agents/hades.md`](.claude/agents/hades.md) |
| Apolo | Documentación (mantiene este README y el HANDOFF) | [`.claude/agents/apolo.md`](.claude/agents/apolo.md) |
| Poseidón | DevOps/infraestructura (modo asesor, nunca ejecuta comandos) | [`.claude/agents/poseidon.md`](.claude/agents/poseidon.md) |

## Documentación

- **[`HANDOFF.md`](HANDOFF.md)** — bitácora técnica viva: estado actual, tareas pendientes, registro de errores. Léela primero al retomar el proyecto.
- **[`docs/adr/`](docs/adr/)** — Architecture Decision Records: por qué se tomó cada decisión relevante.
- **[`AGENTS_SYSTEM_HANDOFF.md`](AGENTS_SYSTEM_HANDOFF.md)** — patrón agnóstico del sistema de agentes, reutilizable en otros proyectos.

## Estado del proyecto

Fase de andamiaje inicial: sistema de agentes y documentación creados. Aún no hay código de producto ni stack técnico confirmado (framework de frontend, modelo de datos en Supabase, mecanismo de autenticación con HubSpot, mecanismo de extracción de Workingbits). Ver la sección "Tareas a seguir" en `HANDOFF.md` para el detalle.

---

_Mantenido por Apolo. Última actualización: 2026-09-01._
