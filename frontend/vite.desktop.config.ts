import { defineConfig, mergeConfig } from 'vite'
import original from './vite.config'

export default defineConfig((context) => {
  const config = typeof original === 'function' ? original(context) : original
  return mergeConfig(config, {
    build: { outDir: '../renderer', emptyOutDir: true, sourcemap: false },
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1') },
  })
})
