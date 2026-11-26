import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/ui', fullyParallel: false, workers: 1, timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'qa-results/report.json' }]],
  use: { baseURL: 'http://127.0.0.1:1427', channel: 'msedge', headless: true, viewport: { width: 1240, height: 820 }, screenshot: 'only-on-failure' },
  outputDir: 'qa-results/artifacts',
  webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 1427 --strictPort', url: 'http://127.0.0.1:1427', reuseExistingServer: false, timeout: 30_000 },
})
