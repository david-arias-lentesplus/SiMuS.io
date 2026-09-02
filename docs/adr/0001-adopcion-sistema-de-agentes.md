# 0001 — Adopción del sistema de agentes especializados

- Estado: Aceptado
- Fecha: 2026-09-01

## Contexto
El proyecto SiMuS.io integra dos sistemas externos (HubSpot y Workingbits), una capa de persistencia crítica (Supabase) y un dashboard de analítica. Sin una división de responsabilidades explícita, el riesgo es que la lógica de integración externa, la persistencia y la UI se mezclen, dificultando el mantenimiento y la trazabilidad de decisiones entre sesiones de trabajo con IA.

## Decisión
Se adopta el patrón de "sistema de agentes especializados" documentado en `AGENTS_SYSTEM_HANDOFF.md` (originado en Proyecto Faro), adaptado a los dominios reales de SiMuS.io:

- **Hermes** — Integración HubSpot (clientes).
- **Iris** — Integración Workingbits (envío y extracción de eventos SMS).
- **Deméter** — Persistencia en Supabase.
- **Hefesto** — UX/UI del dashboard.
- **Minerva** — Rutas y estado global.
- **Eleuthia** — Autenticación y roles del equipo interno.
- **HADES** — QA/Testing, con autoridad de veto (transversal).
- **Apolo** — Documentación (transversal).
- **Poseidón** — DevOps/infraestructura, modo asesor-no-ejecutor (transversal, sin carpeta de código).

Cada agente tiene dominio exclusivo, carpeta propia bajo `src/agents/<codename>/` (salvo Poseidón) y un archivo de definición en `.claude/agents/<codename>.md`.

## Consecuencias
- Toda integración cruzada de dominio debe pasar por hooks/servicios del agente dueño; ningún agente accede al dominio de otro directamente.
- HADES puede bloquear la integración de código con errores.
- Todo cambio de arquitectura relevante requiere documentación de Apolo antes de darse por cerrado.
- Poseidón nunca ejecuta comandos de terminal por su cuenta; siempre los propone para ejecución humana.

## Alternativas consideradas
- Un único asistente/agente genérico trabajando sobre todo el código: descartado por el riesgo de mezclar dominios (ej. UI accediendo directo a APIs externas) y por la pérdida de contexto/reglas entre sesiones.
