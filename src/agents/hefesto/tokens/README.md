# Design tokens — Hefesto

Los tokens viven en `/tailwind.config.js` (raíz del proyecto), no aquí, para
que Tailwind pueda leerlos directamente. Este archivo documenta su origen.

Extraídos de la referencia visual `image_dfbb87.png` provista por el
usuario:

- **Sidebar**: gradiente vertical morado/marino oscuro (`sidebar.from`
  `#241454` → `sidebar.to` `#3E1F73`), íconos de navegación en blanco
  translúcido, activo resaltado en `brand.teal`.
- **Fondo**: gris muy claro `surface` `#F4F5FA`.
- **Tarjetas**: blancas (`card` `#FFFFFF`), esquinas `rounded-card` (16px),
  sombra suave `shadow-card`.
- **Tipografía**: `Inter` / sans-serif del sistema, limpia, sin serif.
- **Colores de métricas** (`metric.sent`/`received`/`delivered`/`failed`/
  `optouts`): pensados originalmente para una gráfica de leyenda "Sent /
  Received / Delivered / Failed / Opt-outs" (checkboxes de la referencia
  visual). **Sin uso todavía** (sesión 2026-09-02): `sms_campaigns` no
  guarda eventos de entrega por mensaje, solo agregados por campaña, así
  que la gráfica real implementada (`ActivityChart.jsx`) usa
  `brand.indigo`/`brand.teal` en su lugar (ver `chartColors.js`). Estos
  tokens quedan reservados para cuando Iris integre eventos de entrega
  reales de Workingbits — no borrarlos.
- **Estados**: `state.success` (verde, ROI positivo), `state.danger` (rojo,
  ROI negativo/fallos), `state.warning` (ámbar).

Regla dura (heredada de `.claude/agents/hefesto.md`): ningún componente usa
un valor hex o de espaciado fuera de `tailwind.config.js`. Si la paleta de
marca real del usuario difiere de esta extracción visual, se actualiza acá
y en `tailwind.config.js` a la vez.
