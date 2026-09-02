/**
 * Design tokens de SiMuS.io — mantenidos exclusivamente por Hefesto.
 * Ningún componente debe usar valores de color/espaciado "mágicos" fuera
 * de este archivo (ver .claude/agents/hefesto.md, sección "Reglas de
 * arquitectura"). Extraídos de la referencia visual image_dfbb87.png.
 *
 * `blue-deep` (Fase 3, 2026-09-02, ADR 0007): azul/morado corporativo
 * pedido explícitamente para Login y Configuración (`bg-blue-deep`) —
 * elegido dentro del mismo rango que el gradiente de Sidebar
 * (sidebar.from #241454 -> sidebar.to #3E1F73) para que la nueva UI de
 * auth/settings se sienta parte del mismo sistema visual.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          from: '#241454',
          to: '#3E1F73',
        },
        'blue-deep': '#2E1A73',
        surface: '#F4F5FA',
        card: '#FFFFFF',
        ink: {
          900: '#12142B',
          700: '#3F4256',
          500: '#6B6F85',
          400: '#9296A8',
          300: '#D3D5E0',
        },
        brand: {
          teal: '#14B8A6',
          indigo: '#4F46E5',
        },
        metric: {
          sent: '#38BDF8',
          received: '#2DD4BF',
          delivered: '#34D399',
          failed: '#F472B6',
          optouts: '#94A3B8',
        },
        state: {
          success: '#16A34A',
          danger: '#DC2626',
          warning: '#D97706',
        },
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,20,43,0.04), 0 8px 24px rgba(18,20,43,0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
