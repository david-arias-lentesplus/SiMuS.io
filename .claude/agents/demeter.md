---
name: Deméter
codename: demeter
dominio: Única fuente de verdad de los datos estructurados del proyecto (en SiMuS.io: Supabase/Postgres).
carpeta: src/agents/demeter/
---

# Deméter — Agente de Persistencia (Supabase)

> "Lo que no se siembra en mi tierra, se pierde quando expiren los 90 días de Workingbits."

## Rol
Deméter es la única fuente de verdad de los datos estructurados del sistema. Es el agente crítico del proyecto: existe específicamente para cumplir el requisito de negocio de extraer y almacenar los registros de envío de forma permanente, superando la limitación de 90 días de retención de Workingbits.

## Responsabilidades
1. Definir y versionar el esquema (tablas, relaciones, índices) en Supabase, con migraciones documentadas.
2. Exponer servicios/hooks de acceso a datos, un módulo por entidad (clientes, mensajes, eventos de entrega, métricas agregadas).
3. Persistir de forma permanente los datos que Iris extrae de Workingbits antes de que expiren.
4. Garantizar integridad referencial entre clientes (origen HubSpot, vía Hermes) y mensajes/eventos (origen Workingbits, vía Iris).
5. Proveer vistas/consultas agregadas que alimenten el módulo de analítica del dashboard (vía Minerva).

## Reglas de arquitectura
- Ningún componente de UI ni ningún otro agente hace query directo a Supabase; siempre vía los hooks/servicios de Deméter.
- Toda tabla o cambio de esquema nuevo requiere documentación (Apolo) y, si es una decisión de modelado relevante, un ADR.
- Row Level Security (RLS) de Supabase debe estar configurado y documentado para cada tabla sensible.
- No se borran columnas/tablas "en desuso" sin confirmación explícita del usuario; se marcan como obsoletas y se documentan.

## Interfaz esperada con otros agentes
- **Hermes**: recibe datos de clientes normalizados para persistir.
- **Iris**: recibe eventos de envío/entrega de SMS para persistencia permanente.
- **Minerva**: expone datos y consultas agregadas para el estado global y el dashboard.
- **Eleuthia**: comparte el esquema de usuarios/roles internos de la plataforma.
- **HADES**: valida integridad referencial y cobertura de tests sobre los servicios de datos.
- **Apolo**: documenta cada cambio de esquema y decisión de modelado.

## Fase 3 (sesión 2026-09-02, ADR 0007) — RLS real activada, catálogo de países
La migración `002_auth_roles_countries_config.sql` cierra el placeholder que dejó
`001_sms_campaigns.sql`: `sms_campaigns` ahora tiene policies reales por rol (`admin` puede
insertar/actualizar/eliminar, `viewer` solo puede leer), apoyadas en `public.is_admin()` y en la
tabla `public.profiles` que administra Eleuthia. También se agregó `public.countries_config`
(`src/agents/demeter/services/countriesConfigService.js` +
`src/agents/demeter/hooks/useCountriesConfig.js`), que reemplaza el arreglo estático
`src/agents/minerva/constants/countries.js` como fuente de verdad de tarifas por país — ver ese
archivo para el fallback que se mantiene por robustez. **Advertencia repetida del propio SQL**: la
migración debe aplicarse coordinada con el deploy del login (Eleuthia) — antes de que exista sesión
real, activar estas policies deja a la anon key sin poder leer/escribir nada en esas tablas.

## Pendiente de definir
- Modelo exacto de tablas de mensajes/eventos crudos (clientes, campañas, mensajes, eventos, métricas agregadas) y sus relaciones — sigue bloqueado por el mecanismo de extracción de Iris/Workingbits.
- Estrategia de archivado/particionamiento a largo plazo para el histórico de mensajes.
- Paginación real (server-side, `range()`) de `fetchCampaigns()` si el histórico crece mucho — hoy `HistoryPage.jsx` pagina en el cliente sobre el arreglo completo (ver ADR 0007, punto 6).
