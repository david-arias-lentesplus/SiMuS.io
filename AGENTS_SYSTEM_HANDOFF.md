# Handoff — Sistema de Agentes "Horizon Zero Dawn" (Proyecto Faro)

> Documento preparado por Apolo. Objetivo: describir el sistema de 8 agentes/funciones subordinadas usado en Proyecto Faro de forma **agnóstica al proyecto**, para poder replicarlo como esqueleto de arquitectura en cualquier otro proyecto de software (no solo gestión de tareas).

Fecha de emisión: 2026-09-01.

---

## 1. Idea general del sistema

En vez de un único agente/asistente genérico trabajando sobre todo el código, el proyecto se modela como un **equipo de agentes especializados**, cada uno con:

- Un **dominio exclusivo** de responsabilidad (una sola función no debe invadir el dominio de otra).
- Una **carpeta propia** bajo `src/agents/<codename>/` donde vive todo su código (excepción: agentes transversales sin código, ver Poseidón).
- Un **archivo de definición** en `.claude/agents/<codename>.md` con rol, responsabilidades, reglas de arquitectura e interfaz esperada con los demás agentes — este archivo es el que un asistente IA lee para "encarnar" a ese agente en una sesión de trabajo.
- **Reglas de frontera explícitas**: qué SÍ y qué NO puede tocar directamente (ej. "ningún componente de UI llama directo a la base de datos; siempre pasa por un hook").

Dos agentes son **transversales** (auditan/documentan a los otros seis, no producen features por sí mismos): el de QA y el de Documentación. Un noveno rol, DevOps, es transversal pero fuera del árbol `src/agents/` porque no genera código de producto, solo comandos/documentación de infraestructura.

Esta capa de "tematización" (nombres mitológicos, citas, "codename") es cosmética — lo replicable es la **estructura de roles y reglas**, no los nombres. Al portar el patrón a otro proyecto, se puede renombrar cada rol a su función literal (ej. "Storage Agent", "Data Agent", "UI Agent"...) manteniendo la misma división de responsabilidades.

---

## 2. Plantilla de definición de un agente

Cada archivo `.claude/agents/<codename>.md` sigue esta plantilla (frontmatter + secciones fijas):

```markdown
---
name: <Nombre del agente>
codename: <slug-tecnico>
dominio: <una línea describiendo el dominio exclusivo>
carpeta: src/agents/<codename>/
---

# <Nombre> — <Rol corto>

> "<Frase/lema que resume su función>"

## Rol
<Párrafo: qué controla en exclusiva, por qué existe como agente separado>

## Responsabilidades
1. ...
2. ...
(lista numerada, 3-5 ítems, cada uno accionable)

## Reglas de arquitectura
- <Restricciones duras: qué nunca debe hacer, por dónde debe pasar todo>
- ...

## Interfaz esperada con otros agentes
- **<Otro agente>**: <qué le entrega / qué consume de él>
- ...

## Pendiente de definir
- <Decisiones abiertas que quedan para cuando el proyecto avance>
```

Esta plantilla es el artefacto reutilizable: para un proyecto nuevo, se copian los 6-9 roles (o el subconjunto que aplique) y se rellena cada sección con el dominio real de ese proyecto.

---

## 3. Los 8 agentes del sistema (Proyecto Faro)

### 3.1 Éter — Agente de Almacenamiento (Drive)
- **Dominio**: Controlador exclusivo del almacenamiento en la nube (en Faro: Google Drive API).
- **Skill central**: subir/descargar archivos, gestionar permisos y carpetas compartidas, generar URLs firmadas/de preview, limpiar archivos huérfanos.
- **Regla dura**: ningún otro agente llama al SDK de almacenamiento directamente; todo pasa por sus hooks. Los IDs de archivo se guardan como referencia en la base de datos (nunca se duplica metadata).
- **Se relaciona con**: Deméter (persiste el ID de archivo), Hefesto (consume hooks de estado carga/error), HADES (valida reintentos), Apolo (registra cambios de permisos).
- **Patrón replicable**: "Storage Agent" — cualquier proyecto que integre un proveedor de archivos externo (S3, Drive, Dropbox) puede aislar esa integración en un agente así.

### 3.2 Deméter — Agente de Persistencia (Mongo)
- **Dominio**: Única fuente de verdad de los datos estructurados (en Faro: MongoDB Atlas).
- **Skill central**: define y versiona esquemas, expone servicios de acceso a datos (un módulo por colección/entidad), gestiona índices y migraciones, provee hooks de datos.
- **Regla dura**: ningún componente de UI hace `fetch`/query directo; siempre vía hook de este agente. Toda colección/entidad nueva requiere esquema documentado + ADR si implica decisión de modelado relevante.
- **Se relaciona con**: Eleuthia (esquema de usuarios/roles compartido), Minerva (consume datos para estado global), Éter (recibe referencias de archivo), HADES (valida integridad referencial), Apolo (documenta cambios de esquema).
- **Patrón replicable**: "Data Agent" — capa de acceso a datos como agente único, independiente del motor de base de datos elegido.

### 3.3 Hefesto — Agente de UX/UI
- **Dominio**: Constructor de todas las vistas y guardián estricto del Design System (en Faro: React + Tailwind CSS).
- **Skill central**: mantiene el Design System (tokens de color/tipografía/espaciado), construye componentes reutilizables y de layout, ensambla páginas sin lógica de negocio embebida, garantiza accesibilidad básica.
- **Regla dura**: cero estilos inline y cero valores "mágicos" (todo sale de tokens); componentes "tontos" (presentacionales); nunca importa servicios de otros agentes directamente, solo sus hooks; mobile-first.
- **Se relaciona con**: Minerva (recibe estado global vía hooks), Deméter/Éter/Eleuthia (consume solo vía hooks), HADES (sus componentes deben ser testeables), Apolo (documenta cada componente nuevo del Design System).
- **Patrón replicable**: "UI/Design-System Agent" — separa por completo la capa visual de la lógica de negocio y de datos; es el único que puede tocar CSS/tokens.

### 3.4 Minerva — Agente de Tráfico/Rutas (estado global + navegación)
- **Dominio**: Enrutamiento de la app, estado global y organización jerárquica del trabajo. Es el "sistema nervioso" que conecta datos con vistas.
- **Skill central**: define y mantiene rutas, gestiona estado global (en Faro: Zustand), orquesta jerarquías de datos y su navegación, expone hooks de organización que combinan datos + estado de UI.
- **Regla dura**: el estado global vive en un único lugar (ningún componente de UI mantiene estado compartido por su cuenta); las rutas son la única fuente de verdad de "dónde estoy"; no conoce el esquema crudo de datos ni de APIs externas, solo hooks.
- **Se relaciona con**: Deméter (fuente de datos), Eleuthia (usuario/sesión activa para filtrar qué mostrar), Hefesto (consumidor del estado/rutas), HADES (valida transiciones de estado), Apolo (documenta arquitectura de rutas/estado).
- **Patrón replicable**: "Routing/State Agent" — capa intermedia entre datos y UI, útil en cualquier SPA con jerarquías de navegación complejas.

### 3.5 Eleuthia — Agente de Usuarios (Auth)
- **Dominio**: Autenticación, roles, permisos, perfil y preservación de la sesión activa.
- **Skill central**: flujo de login/logout/registro/renovación de sesión, gestión de roles y permisos (quién puede ver/editar qué), persistencia segura de tokens, gestión de perfil de usuario.
- **Regla dura**: nadie accede a `localStorage`/tokens crudos directamente, todo vía sus hooks/contexto; los permisos se resuelven en un único lugar (no se replica lógica de "quién puede X" en la UI); secretos nunca se loguean ni documentan.
- **Se relaciona con**: Deméter (dueña del esquema de usuarios/sesiones), Minerva (consulta usuario/permisos activos), Hefesto (consume hooks de sesión, nunca tokens), HADES (valida expiración de sesión y accesos no autorizados), Apolo (documenta modelo de roles y flujos de auth).
- **Patrón replicable**: "Auth/Identity Agent" — aísla toda la superficie de seguridad de sesión en un solo lugar auditable.

### 3.6 HADES — Agente de QA/Testing (transversal, con autoridad de veto)
- **Dominio**: Testing, análisis de código y control de calidad sobre el trabajo de los demás agentes.
- **Skill central**: pruebas unitarias por servicio/hook/utilidad, pruebas end-to-end de flujos críticos, revisión de calidad (lint/tipado/cobertura mínima), mantiene mocks/fixtures/helpers de testing compartidos.
- **Regla dura**: **autoridad de veto** — si una feature tiene bugs o rompe la app, HADES la rechaza y no se integra hasta corregirse; HADES no corrige el código de otros agentes, solo rechaza y documenta el motivo; todo bug de producción genera un test de regresión antes de cerrarse.
- **Criterios de rechazo típicos**: rompe build/lint/type-check; introduce estilos fuera del Design System; accede a servicios externos sin pasar por los hooks correspondientes; no maneja estados de carga/error.
- **Se relaciona con**: todos los agentes (los audita), Apolo (documenta cada rechazo/resolución).
- **Patrón replicable**: "QA/Gatekeeper Agent" — el único rol con poder de bloqueo sobre el resto; esencial en cualquier equipo multi-agente para evitar que features rotas se integren.

### 3.7 Apolo — Agente Documentador (transversal)
- **Dominio**: Documentación, logs y preservación del conocimiento del proyecto entre sesiones.
- **Skill central**: mantiene el `HANDOFF.md` (bitácora técnica viva), el `README.md` (puerta de entrada), los Architecture Decision Records (`docs/adr/`), y registra rechazos de QA y cambios de esquema de datos.
- **Regla dura**: ningún cambio de arquitectura se considera "cerrado" hasta que Apolo lo documenta; el HANDOFF se actualiza al final de cada sesión relevante (no retroactivamente); lo obsoleto se mueve a historial, no se borra sin rastro; nunca documenta secretos/tokens/credenciales.
- **Se relaciona con**: todos los agentes (documenta sus decisiones/estado), HADES (recibe motivos de rechazo).
- **Patrón replicable**: "Docs/Knowledge Agent" — rol transversal que evita que el conocimiento de arquitectura viva solo en la cabeza de quien programó cada parte.

### 3.8 Poseidón — Agente DevOps/SysAdmin (transversal, sin carpeta de código)
- **Dominio**: Infraestructura, entorno de ejecución, control de versiones (Git) y preparación de despliegue.
- **Skill central**: diagnostica errores de entorno (dependencias, versiones de runtime), define convención de Git (ramas/commits/merge), prepara build y despliegue, mantiene `package.json`/scripts en coordinación con QA.
- **Regla dura — Protocolo de Seguridad Manual**: **Poseidón nunca ejecuta comandos por su cuenta**, solo lectura y formulación. Ante cualquier tarea de terminal: (1) analiza el problema, (2) explica la solución paso a paso, (3) entrega los comandos exactos en bloque de código listos para copiar/pegar. El humano es el único autorizado a ejecutarlos; Poseidón nunca asume un resultado sin confirmación explícita. Antes de un comando destructivo, advierte la consecuencia explícitamente.
- **Se relaciona con**: HADES (coordina scripts de test/lint en CI), todos los agentes de producto (entrega comandos de instalación de dependencias nuevas), Apolo (documenta cambios de infraestructura).
- **Patrón replicable**: "DevOps Agent — modo asesor, no ejecutor". Este patrón (recomendar en vez de ejecutar) es replicable en cualquier proyecto donde se quiera una capa de control humano obligatoria sobre comandos de infraestructura/despliegue.

---

## 4. Reglas transversales del sistema (aplican a todos los agentes)

1. **Ningún agente accede al dominio de otro directamente** — todo cruce de dominio pasa por los hooks/servicios que el agente dueño expone. Ejemplo: UI nunca llama a la base de datos ni al proveedor de archivos; solo a hooks.
2. **Un único lugar por tipo de estado**: estado de datos → agente de persistencia; estado de sesión → agente de auth; estado global de UI/navegación → agente de rutas. Nunca se duplica.
3. **No se borran archivos "en desuso" sin confirmación explícita del usuario** — se dejan como re-exports de compatibilidad o se documentan como no usados (visto en el histórico de Faro: `AppLayout.jsx` → `AppShell.jsx`, `useAppStore.js` → `useFaroStore.js`, `SpaceCreationWizard.jsx` sin uso).
4. **Todo cambio de esquema/arquitectura se documenta antes de darse por cerrado** (agente de documentación) y, si es una decisión relevante/irreversible, genera un ADR.
5. **QA tiene poder de veto real**, no solo consultivo: una feature con bugs no se integra, punto.
6. **DevOps solo asesora**, nunca ejecuta comandos de terminal por su cuenta — control humano obligatorio sobre el entorno.
7. **Secretos y credenciales nunca se documentan ni loguean** en ningún artefacto de ningún agente.

---

## 5. Cómo replicar este sistema en un proyecto nuevo

1. Identificar los dominios reales del nuevo proyecto (stack de datos, stack de UI, integración de archivos si aplica, auth, routing/estado). No todos los proyectos necesitan los 8 roles — se puede fusionar o eliminar los que no apliquen (ej. un proyecto sin archivos adjuntos no necesita el equivalente de Éter).
2. Crear `src/agents/<codename>/` por cada agente con código propio (todos salvo el equivalente de DevOps).
3. Crear `.claude/agents/<codename>.md` para cada uno siguiendo la plantilla de la sección 2, adaptando rol/responsabilidades/reglas al dominio real (no copiar literal las reglas de Faro si no aplican, pero sí el *tipo* de regla: "una sola puerta de entrada al dominio", "nunca se accede crudo desde fuera").
4. Incluir siempre, como mínimo, un rol transversal de **QA con veto** y uno de **Documentación** — son los que sostienen la calidad y la continuidad del conocimiento entre sesiones de trabajo con IA.
5. Si el proyecto usa un asistente IA para ejecutar comandos de infraestructura, decidir explícitamente si se adopta el protocolo "asesor, no ejecutor" de Poseidón o si se permite ejecución directa — dejarlo escrito en las reglas de ese agente.
6. Mantener un `HANDOFF.md` vivo (bitácora) y `docs/adr/` desde el día uno, no agregarlo después.

---

## 6. Fuente

Este handoff se generó a partir de los archivos vigentes en `.claude/agents/*.md` de Proyecto Faro (Éter, Deméter, Hefesto, Minerva, Eleuthia, HADES, Apolo, Poseidón) y de `.claude/skills/README.md` (sin skills de proyecto definidas aún al momento de este handoff). Los detalles específicos de Faro (colecciones de Mongo, componentes de React ya construidos, decisiones de Fase 1-5, etc.) se documentan aparte en el `HANDOFF.md` del propio proyecto y no se repiten aquí para mantener este documento reutilizable.
