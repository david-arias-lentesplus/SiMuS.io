# SiMuS.io — Análisis de sitio en vivo y recomendaciones para Fase 3

**Fecha:** 2026-09-02
**Alcance:** Auditoría de https://simus-one.vercel.app/ (build desplegado antes de los fixes de
esta sesión) + revisión del código fuente actual. Preparado por Apolo con verificación de Hermes,
Deméter, Eleuthia y Hades.

## 1. Estado confirmado del deploy en vivo

- **Bug crítico confirmado:** recargar cualquier ruta de cliente (`/calculadora`, `/historico`)
  devuelve un 404 `NOT_FOUND` de Vercel en vez de servir la SPA. Causa: falta un rewrite en
  `vercel.json` que redirija todo a `index.html` excepto `/api/*`. **Ya corregido en esta sesión**
  (ver `vercel.json` en la raíz del repo) — pendiente de que el usuario despliegue el cambio.
- **Gráfica "Actividad de Campañas" del Dashboard:** en el deploy auditado todavía mostraba el
  placeholder de Fase 1 en vez de datos reales de Supabase. **Ya corregido en esta sesión**
  (`useCampaignActivitySeries.js` + `ActivityChart.jsx`) — pendiente de deploy.
- **Integración HubSpot (Fase 2, agente Hermes):** verificada funcionando en producción durante
  esta auditoría — el endpoint `/api/hubspot/segment` responde correctamente y el manejo de
  errores en el formulario de la Calculadora se comporta como se diseñó. Es la única pieza de
  Fase 2 que ya se pudo confirmar end-to-end fuera de este entorno de desarrollo.

## 2. Hallazgo nuevo: la aplicación no tiene autenticación

`src/agents/eleuthia/` (el agente responsable de auth) solo contiene un `README.md` — no hay
código de autenticación en ningún punto del repo, ni en el cliente ni en las funciones
serverless de `/api`. Esto significa que, tal como está desplegado hoy:

- Cualquier persona con la URL puede ver el histórico completo de campañas y sus métricas de ROI.
- Cualquier persona puede usar la Calculadora, disparar búsquedas reales contra la API de HubSpot
  (a través de `/api/hubspot/segment`, que sí exige `HS_PAT` en el servidor pero no exige que
  quien llama esté autenticado) y, si conociera el flujo, aprobar y escribir filas nuevas en
  `sms_campaigns` de Supabase.
- No hay ningún control de "solo lectura" vs "puede aprobar/guardar": el botón de aprobación está
  disponible para cualquier visitante.

Esto no bloqueó el desarrollo de Fase 1/2 porque el foco fue validar el flujo de cálculo e
integración primero, pero es la brecha de mayor riesgo antes de compartir la URL fuera del equipo
o de conectar credenciales de producción reales de HubSpot (hoy en un Private App Token con
permisos de lectura sobre contactos y listas).

## 3. Recomendaciones para la siguiente fase, en orden de prioridad

1. **Autenticación mínima (Eleuthia).** No hace falta un sistema de usuarios completo para
   empezar: Supabase Auth con un solo método (magic link o password) y una tabla de allowlist de
   correos del equipo cubriría el riesgo inmediato. El histórico y la aprobación de campañas son
   las dos superficies a proteger primero.
2. **Cerrar el gap de Iris (conversiones reales vía Metabase).** Ver sección 4 — es el ítem más
   grande de producto pendiente: hoy el "cruce de compras en los 7 días posteriores al envío"
   sigue siendo una simulación determinística (`simulateConversions.js`), no un dato real.
3. **Confirmar el deploy de los dos fixes de esta sesión** (`vercel.json`, gráfica de actividad) y
   volver a auditar en vivo después del deploy, ya que ambos se validaron con revisión de código y
   no se pudieron probar en un navegador real contra el build nuevo (el entorno de desarrollo de
   este puente no puede correr `npm run build`/`vercel dev` — ver incidencia registrada en
   `HANDOFF.md`).
4. **Página de Histórico (`/historico`).** No se auditó a fondo en esta pasada; vale la pena una
   revisión específica de paginación/filtros ahora que el volumen de campañas reales empezará a
   crecer con HubSpot conectado.
5. **Manejo de errores de red en la Calculadora.** El flujo de búsqueda de segmento ya maneja
   errores de HubSpot (probado en vivo), pero conviene una pasada de Hades sobre qué pasa si
   Supabase no responde al momento de "Aprobar y Guardar" (reintentos, mensaje al usuario, o
   pérdida silenciosa del reporte calculado).

## 4. Estado de la integración con Metabase (Iris) — gap confirmado

Se exploró el conector `livo_metabase` (acceso de solo lectura al Data Warehouse) buscando una
tabla que permita reemplazar `simulateConversions.js` por un cruce real: "clientes de una
lista/segmento de HubSpot que compraron dentro de los 7 días posteriores al envío del SMS".

**Se encontró la tabla de ventas correcta** — `ss.silver_sales` (base `livo_command_center`,
id=16) — con timestamps de todo el ciclo de vida del pedido (`created_at` → `delivered_at` /
`canceled_at`), ideal para calcular la ventana de 7 días. También se revisaron
`silver_sales_products`, `silver_pedidos_pdv` y `silver_pedidos_kpl` (más columnas del pedido:
canal, tienda, método de envío, fechas de cada etapa logística).

**El problema:** ninguna de esas tablas de ventas/pedidos tiene una columna que identifique al
cliente (sin email, teléfono, documento ni `customer_id`). Del lado de HubSpot sí existe
`hubspot_contacts` (base `MKT`, id=15) con `contact_id`, `email`, `firstname`, `lastname` — pero
no hay ninguna tabla intermedia en el warehouse que conecte un pedido de `silver_sales` con un
`contact_id` o `email` de HubSpot. Se buscaron específicamente puentes candidatos
("cliente", "customer", "gold customer") sin resultado: las únicas tablas con datos de cliente
encontradas son `clients` (acotada a pedidos de MercadoLibre) y `kpl_clients_orders` (un log de
sincronización ETL, no un mapeo cliente↔pedido).

**Conclusión honesta:** con el acceso actual al warehouse no es posible construir el cruce real
sin antes confirmar con quien administra el DWH cuál es la columna o tabla que vincula un pedido
de `silver_sales`/`silver_pedidos_*` con la identidad del cliente (lo más probable es que exista
en una tabla que no apareció en la búsqueda por nombre, o que el vínculo se resuelva por otro
campo como número de documento almacenado en otro sistema). **Recomendación:** antes de que Iris
escriba el query real, alguien del equipo de datos debe indicar qué columna de `silver_sales` (o
qué tabla puente) contiene el identificador de cliente. Una vez confirmado ese campo, el query
tiene forma directa:

```sql
-- forma objetivo, una vez identificada la columna <customer_key> en silver_sales
select count(distinct s.<customer_key>) as clientes_que_compraron
from ss.silver_sales s
join hubspot_contacts_en_lista l on l.<customer_key> = s.<customer_key>
where s.created_at between :fecha_envio_sms and :fecha_envio_sms + interval '7 days'
  and s.status not in ('canceled');
```

Hasta que se resuelva ese punto, `simulateConversions.js` sigue siendo el mecanismo correcto para
no bloquear el resto del flujo — está documentado en el código y en `HANDOFF.md` como simulación
temporal, no como dato real.
