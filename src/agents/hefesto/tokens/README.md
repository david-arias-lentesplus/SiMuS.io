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
- **Colores de métricas** (gráfica de actividad SMS): `metric.sent`
  (celeste), `metric.received` (turquesa), `metric.delivered` (verde),
  `metric.failed` (rosa/magenta), `metric.optouts` (gris) — mapeados a los
  checkboxes de leyenda "Sent / Received / Delivered / Failed / Opt-outs"
  de la referencia.
- **Estados**: `state.success` (verde, ROI positivo), `state.danger` (rojo,
  ROI negativo/fallos), `state.warning` (ámbar).

Regla dura (heredada de `.claude/agents/hefesto.md`): ningún componente usa
un valor hex o de espaciado fuera de `tailwind.config.js`. Si la paleta de
marca real del usuario difiere de esta extracción visual, se actualiza acá
y en `tailwind.config.js` a la vez.
