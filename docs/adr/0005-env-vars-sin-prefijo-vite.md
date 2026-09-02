# ADR 0005 — Variables de entorno del cliente sin prefijo VITE_

- **Fecha**: 2026-09-02
- **Estado**: Aceptado
- **Decide**: Usuario (a partir de un problema real al configurar env vars en Vercel)

## Contexto

Al configurar `HS_PAT` en Vercel (ver ADR 0004), la UI de Vercel mostró un aviso: "Remove the
public framework prefix to keep this value private. Public prefixes expose values to the browser."
Ese mismo aviso apareció también para `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — ahí es un
falso positivo (esas dos SÍ están pensadas para ser públicas: el anon key de Supabase se protege
con Row Level Security, no con secreto), pero el usuario pidió explícitamente sacarles el prefijo
`VITE_` de todas formas a las tres variables, no solo a la de HubSpot.

El problema técnico: Vite, por diseño, solo inyecta en `import.meta.env` (el objeto que el código
de cliente puede leer) las variables de entorno prefijadas `VITE_` — es una protección para que un
`.env` con secretos de servidor no se filtre al bundle del navegador por accidente. Sacarle el
prefijo a una variable sin hacer nada más significa que deja de llegar al cliente y la app se
rompe (en este caso, la conexión a Supabase).

## Decisión

- `SUPABASE_URL` y `SUPABASE_ANON_KEY` (antes `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`) viven
  en `.env.local`/Vercel sin prefijo.
- `vite.config.js` las carga explícitamente con `loadEnv(mode, process.cwd(), '')` (tercer
  argumento vacío = sin filtro de prefijo) y las expone al cliente una por una vía la opción
  `define`, mapeando `import.meta.env.SUPABASE_URL`/`import.meta.env.SUPABASE_ANON_KEY` a su valor
  literal en tiempo de build.
- Deliberadamente **no** se cambió `envPrefix` a `''` (que expondría automáticamente *todas* las
  variables de entorno al cliente, incluido `HS_PAT`) — se prefirió `define` variable por variable
  para mantener explícito y auditable qué llega al navegador y qué no. Cualquier variable nueva que
  deba exponerse al cliente en el futuro debe agregarse a mano en `vite.config.js`, nunca vía un
  `envPrefix` amplio.
- `HS_PAT` no cambia: sigue sin prefijo y sigue sin `define` — nunca debe llegar al cliente (ver
  ADR 0004).

## Consecuencias

- En Vercel, el aviso de "public framework prefix" ya no debería aparecer para ninguna de las tres
  variables, porque ninguna empieza con un prefijo de framework reconocido.
- Cualquier desarrollador que agregue una nueva variable de entorno que el cliente necesite leer
  debe acordarse de añadir su `define` correspondiente en `vite.config.js` — a diferencia del
  mecanismo estándar de Vite (prefijo `VITE_` automático), este paso ya no es automático. Documentado
  en `vite.config.js` y `supabaseClient.js`.
- Si el equipo prefiere volver al mecanismo estándar de Vite en el futuro (aceptando el aviso de
  Vercel como un falso positivo y simplemente marcando esas variables como "Config" en su UI en vez
  de "Sensitive"), este ADR debería marcarse como Superseded por uno nuevo.

## Alternativas consideradas

- **Dejar el prefijo `VITE_` y marcar las variables como "Config" en Vercel** (la opción que el
  propio diálogo de Vercel ofrece: "If that's safe, change the variable to Config"): es el camino
  más simple y estándar, pero el usuario pidió explícitamente sacar el prefijo en su lugar.
- **`envPrefix: ''` en `vite.config.js`**: descartada — expondría automáticamente cualquier
  variable de entorno del proyecto al cliente, incluido `HS_PAT` por accidente en cuanto alguien
  agregue una variable nueva sin pensar en esto.
