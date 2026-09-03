# Éter — Agente de Ingesta y Transformación de Datos (CSV Workingbits)

Ver `.claude/agents/eter.md` para el rol completo, reglas de arquitectura e interfaz con otros
agentes. Este README solo indica dónde vive cada pieza de código.

- `utils/parseWorkingbitsCsv.js` — función pura: filas de PapaParse -> campañas agrupadas
  (`fecha`, `mensaje`, `muestraEntregados`, `telefonosValidos`).
- `utils/cleanPhoneNumber.js` — heurística de limpieza de indicativo de país por teléfono.
- `utils/countryDialCodes.js` — mapeo `value` de país -> indicativo telefónico.

Creado en el pivote de Fase 2.1 (descarte de la API de Workingbits en favor de carga manual de CSV).
Éter es un agente nuevo en SiMuS.io — no existía en las Fases 1-3; ver el ADR 0008 y la nota de
adaptación de dominio en `.claude/agents/eter.md`.
