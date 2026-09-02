import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config base de Vite. Poseidon debe revisar/aprobar cualquier cambio de
// build antes de aplicarse (protocolo asesor-no-ejecutor, ver
// .claude/agents/poseidon.md).
export default defineConfig({
  plugins: [react()],
});
