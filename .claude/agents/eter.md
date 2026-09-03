---
name: Éter
codename: eter
dominio: Única puerta de entrada a la ingesta y transformación de archivos CSV exportados por Workingbits.
carpeta: src/agents/eter/
---

# Éter — Agente de Ingesta y Transformación de Datos (CSV Workingbits)

> "Nada cruza del archivo crudo a la base de datos sin pasar por mi filtro."

## Rol
Éter no existía todavía en SiMuS.io: en el patrón original de Proyecto Faro (ver
`AGENTS_SYSTEM_HANDOFF.md`, sección 3.1) su dominio era el almacenamiento en la nube (Google Drive).
Ese dominio no aplica aquí porque SiMuS.io no integra un proveedor de archivos externo. Por
instrucción explícita del usuario (sesión "PIVOTE FASE 2.1 — Descarte de la API de Workingbits"),
se reutiliza el codename/rol transversal "Éter" para un dominio distinto pero del mismo tipo
("agente dueño de una fuente de datos externa que exige transformación antes de tocar el resto del
sistema"): la ingesta del CSV que el usuario exporta manualmente de la plataforma Workingbits.

Existe como agente separado porque parsear/agrupar/limpiar un CSV exportado por un tercero tiene su
propia lógica (agrupación por campaña, conteo estricto de entregados, limpieza de indicativos de
país por teléfono) que no debe mezclarse ni con la persistencia (Deméter) ni con el cruce de
conversiones (Hermes).

## Responsabilidades
1. Parsear el CSV exportado por Workingbits (columnas `Communication Name`, `Send At`, `Text`,
   `To`, `Status`) a estructuras de datos limpias en memoria — nunca en el servidor, todo ocurre en
   el navegador antes de persistir nada.
2. Agrupar las filas por `Communication Name` (una fila del CSV = un destinatario; una campaña =
   todas las filas que comparten el mismo nombre de comunicación).
3. Por cada campaña agrupada, calcular de forma estricta: `fecha` (primer `Send At` del grupo),
   `mensaje` (primer `Text` del grupo), `muestra_entregados` (conteo de filas con
   `Status === 'Delivered'`, excluyendo rebotes/`Rejected`/cualquier otro estado).
4. Limpiar los números de teléfono de las filas `Delivered` quitando el indicativo del país
   seleccionado por el usuario en `/upload` (ej. quitar `57` para Colombia, `52` para México) para
   producir `telefonos_validos`, el array que Hermes usará para el cruce contra Metabase.
5. Entregar la data ya procesada (nunca el CSV crudo) a Deméter para persistencia en
   `sms_processed_campaigns`; Éter mismo nunca escribe en Supabase.

## Reglas de arquitectura
- Ningún otro agente parsea el CSV de Workingbits ni reimplementa la limpieza de teléfonos por su
  cuenta; todo pasa por `src/agents/eter/utils/parseWorkingbitsCsv.js`.
- Éter es puramente funciones puras (sin estado, sin red, sin acceso a Supabase): recibe filas ya
  parseadas por PapaParse (Hefesto se encarga de leer el archivo) y devuelve estructuras en memoria.
- La limpieza de indicativo de país es una heurística documentada (ver
  `utils/cleanPhoneNumber.js`), no una certeza matemática: el formato exacto de la columna `To` del
  CSV real de Workingbits no se pudo verificar contra un archivo de ejemplo en la sesión en que se
  escribió este código — cualquier caso raro (formato con `+`, con 0 inicial, sin indicativo) debe
  revisarse con un CSV real antes de confiar ciegamente en el conteo de `telefonos_validos`.
- `muestra_entregados` es siempre un conteo estricto de `Status === 'Delivered'` — nunca se infiere
  de otra columna ni se aproxima.

## Interfaz esperada con otros agentes
- **Hefesto**: `/upload` (vista de Hefesto) llama a `parseWorkingbitsCsv()` con las filas ya leídas
  por PapaParse y el país elegido; Éter le devuelve el array de campañas agrupadas para mostrar un
  resumen antes de guardar.
- **Deméter**: recibe de Éter (vía Hefesto) el array de campañas procesadas para el insert en
  `sms_processed_campaigns` — Éter nunca llama a Supabase directamente.
- **Hermes**: consume `telefonos_validos` de la campaña que el usuario elige en la Calculadora para
  el cruce de conversiones contra Metabase — Éter ya entregó esos teléfonos limpios antes, Hermes no
  vuelve a tocar el CSV.
- **Apolo**: documenta esta adaptación de dominio (ver ADR 0008) y cualquier ajuste futuro a la
  heurística de limpieza de teléfonos una vez se valide contra un CSV real de Workingbits.

## Pendiente de definir
- Validar `cleanPhoneNumber()` contra un CSV real exportado de Workingbits (formato exacto de la
  columna `To`: ¿siempre con indicativo?, ¿alguna vez con `+`?, ¿algún cero inicial?) — la heurística
  actual es la mejor suposición razonable, no una certeza probada end-to-end.
- Igual riesgo, ahora también para `detectCountryFromCsv.js` (Fase 2.3): el formato exacto de las
  columnas `Country Name` y `Communication Start Date` del CSV real de Workingbits tampoco se pudo
  verificar contra un archivo de ejemplo. La normalización de `Country Name` (minúsculas, sin
  acentos) cubre las variantes más probables ("Colombia", "México"/"Mexico", "Brasil"/"Brazil"), y
  cualquier valor no reconocido — incluido el caso ambiguo de Brasil sin prefijo `NL_`/`LV_` en
  `Communication Name` — cae a un modal de confirmación manual en vez de asignar un país adivinado.
  Confirmar con un CSV real que estas dos columnas existen con esos nombres exactos.
- CONFIRMADO en Fase 2.4 (sesión "CORRECCIÓN FASE 2.4 — DEBUGGING DE UI Y PARSEO DE DATOS", QA contra
  base de datos real): las fechas de Workingbits (`Send At`, `Communication Start Date`) SÍ vienen en
  `DD/MM/YYYY HH:mm:ss` — ya no es una suposición, está verificado. `parseWorkingbitsDate.js` asume
  ese formato explícitamente. También se confirmó (y corrigió) un bug real: la resolución de tienda
  de Brasil (NL/LV) se hacía una sola vez por ARCHIVO en vez de por GRUPO/campaña, asignando mal el
  país a campañas `NL_` cuando la primera fila del CSV era de una campaña `LV_` (o viceversa) — ver
  ADR 0013. Ahora se resuelve por grupo en `parseWorkingbitsCsv.js`, nunca heredando el resultado de
  otro grupo del mismo archivo.
- Qué hacer con campañas re-subidas con el mismo `Communication Name` (¿reemplazar la fila anterior
  en `sms_processed_campaigns`, o acumular versiones?) — hoy `processedCampaignsService.js`
  reemplaza (upsert por nombre de campaña), documentado como decisión de esta sesión, revisable.
- Si algún día Iris retoma la integración directa con la API de Workingbits (ver
  `.claude/agents/iris.md`), decidir si Éter desaparece o convive con esa vía como "modo manual de
  respaldo" para cuando la API falle.
