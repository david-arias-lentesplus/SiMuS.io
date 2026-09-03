# 0013 — Corrección Fase 2.4: debugging de UI y parseo de datos (Brasil, fechas, filtro de país)

Fecha: 2026-09-03
Estado: Aceptado (corrige bugs reales de ADR 0012, detectados por QA contra datos de producción)

## Contexto

El usuario reportó, tras revisar la base de datos y la UI reales, tres fallos en lo implementado en
Fase 2.3 (ADR 0012):

1. El selector de País en la Calculadora quedó bloqueado/inactivo, y el dropdown de campañas mezclaba
   todos los países en una sola lista.
2. La fecha de envío no se autocompletaba — el input quedaba vacío y bloqueado.
3. La detección de tienda de Brasil (NL/LV) asignaba `brasil-lv` a campañas que claramente empezaban
   con `NL_`.

## 1. Fix Brasil (bug real de ADR 0012)

**Causa raíz**: `detectCountryFromCsv.js` (ADR 0012) resolvía NL vs LV UNA SOLA VEZ para todo el
archivo, mirando el `Communication Name` de la PRIMERA fila del CSV, y aplicaba ese resultado a TODAS
las campañas del archivo por igual. Un CSV puede traer filas de más de una campaña/comunicación
distinta (`parseWorkingbitsCsv.js` agrupa por `Communication Name`) — si la primera fila del archivo
resultaba ser de una campaña `LV_...`, TODAS las campañas del archivo (incluidas las `NL_...`)
quedaban guardadas como `brasil-lv`.

**Fix**: la resolución NL/LV se mueve de `detectCountryFromCsv.js` (nivel archivo) a
`parseWorkingbitsCsv.js` (nivel grupo). `detectCountryFromCsv` ahora solo confirma que el
`Country Name` es Brasil y devuelve el hint genérico `'brasil'` (`BRAZIL_HINT`); `parseWorkingbitsCsv`
resuelve, POR CADA GRUPO, la tienda a partir del `Communication Name` de ESE grupo puntual
(`campaign_name.includes('NL_')` → `brasil-nl`, `.includes('LV_')` → `brasil-lv`, verificado también
con `startsWith` por la instrucción explícita del usuario). Un archivo con campañas `NL_` y `LV_`
mezcladas ahora las separa correctamente, cada una con su propio `country_value`.

Si un grupo puntual no tiene ninguno de los dos prefijos, `CsvUploadForm.jsx` muestra un modal
POST-parseo pidiendo confirmar la tienda SOLO para esos grupos ambiguos — los que sí se resolvieron
por su propio prefijo no se tocan ni se sobreescriben.

## 2. Fix Fecha (formato DD/MM/YYYY)

**Causa raíz**: el CSV real de Workingbits trae las fechas (`Send At`, `Communication Start Date`) en
formato `DD/MM/YYYY HH:mm:ss` (confirmado por el usuario contra datos reales). El código de ADR 0012
guardaba el valor CRUDO y dejaba que `parseCsvDate.js` (Minerva) lo interpretara al mostrarlo —
`new Date('03/09/2026 14:30:00')` en JavaScript asume MM/DD/YYYY (orden estadounidense), no
DD/MM/YYYY: para día > 12 devuelve `Invalid Date` (campo vacío) y para día ≤ 12 devuelve una fecha
SILENCIOSAMENTE INCORRECTA (día y mes invertidos).

**Fix**: nuevo `src/agents/eter/utils/parseWorkingbitsDate.js`, que asume EXPLÍCITAMENTE
DD/MM/YYYY[ HH:mm[:ss]] (formato verificado, no una suposición genérica) y normaliza a `YYYY-MM-DD`
ANTES de guardar — `parseWorkingbitsCsv.js` lo usa tanto para `fecha` (`Send At`) como para
`fechaComunicacion` (`Communication Start Date`). Se mantiene `parseCsvDate.js` (Minerva) como
segunda capa defensiva, ahora también con un branch explícito DD/MM/YYYY (antes de cualquier
`new Date()` genérico), para que campañas ya guardadas ANTES de este fix (con la fecha cruda vieja en
Supabase) también se muestren correctamente en la Calculadora sin necesidad de volver a subir el CSV.

## 3. Fix Dropdown de País y filtro de campañas (reversión parcial de ADR 0012)

**Causa raíz**: ADR 0012 había invertido el orden de selección — el País se derivaba automáticamente
de la campaña elegida y quedaba ReadOnly, y el dropdown de campañas dejó de filtrarse por país
(listaba las 100+ campañas de todos los países juntas). El usuario, al probarlo, encontró esto peor
que el problema original: el selector de país "bloqueado" (percibido como roto) y una lista de
campañas demasiado larga para buscar a mano.

**Fix**: se revierte esa parte de ADR 0012. "País" vuelve a ser un `<select>` editable, elegido POR EL
USUARIO antes de la campaña. El dropdown de "Nombre de la campaña" vuelve a filtrarse (`.filter()`)
por el país elegido (`useCampaignCalculator.availableProcessedCampaigns`), igual que antes de ADR
0012 — esto ahora SÍ funciona correctamente para Brasil porque el fix de la sección 1 garantiza que
`country_value` está bien asignado por campaña.

**Lo que NO se revierte**: "Fecha de envío" sigue ReadOnly, autocompletada desde
`communication_start_date` de la campaña elegida (eso no era parte del bug reportado — el problema
era que el valor no se calculaba bien, no que estuviera bloqueado; con el fix de la sección 2 el
valor ya se calcula bien y se sigue mostrando sin permitir edición manual, tal como pidió también esta
misma instrucción: "Mantén el input en readOnly... garantizando que el dato se visualice").

## Lección de esta sesión

Los cambios de UI/UX de ADR 0012 (invertir el flujo de selección de país/campaña) se hicieron sin
poder probarlos contra la base de datos real ni la UI corriendo (limitación conocida de este entorno:
no hay `npm run dev`). Cuando una corrección de flujo no puede probarse en vivo, conviene preferir el
cambio MÍNIMO necesario para resolver el problema reportado, en vez de un rediseño más amplio — un
rediseño no probado tiene más superficie para introducir regresiones nuevas (como pasó acá) que una
corrección acotada.

## Estado de verificación

La normalización de fechas (`parseWorkingbitsDate.js`, `parseCsvDate.js`) se probó localmente con
casos reales (`'03/09/2026 14:30:00'` → `'2026-09-03'`, ISO passthrough, fallback genérico) fuera del
entorno del proyecto, antes de integrarla. La resolución de Brasil por grupo y el filtro de país
restaurado NO se pudieron probar contra la base de datos real ni la UI corriendo en este entorno.
Pendiente que el usuario: (1) vuelva a subir un CSV con campañas `NL_`/`LV_` mezcladas y confirme que
cada una queda con su tienda correcta, (2) confirme que la fecha se autocompleta visualmente en la
Calculadora, (3) confirme que el selector de País funciona y filtra el dropdown de campañas como se
espera.
