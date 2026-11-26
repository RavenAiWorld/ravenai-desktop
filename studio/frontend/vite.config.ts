import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/assets/studio/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { 'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify('Raven / Nova 3.4.0') },
  build: { outDir: '../../dist/assets/studio', emptyOutDir: true, target: 'es2022' },
});
