import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(frontend, 'public/model-plaza-source.tar.gz')
// Explicit source roots exclude environment files, audit reports and dependencies.
const roots = [
  'src', 'public', 'scripts', 'licenses', 'THIRD_PARTY_NOTICES.md', '.gitignore',
  'package.json', 'pnpm-lock.yaml', 'index.html', 'postcss.config.js',
  'tailwind.config.js', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.ts',
  'vitest.config.ts', '.eslintrc.cjs', '.eslintignore'
].map(name => `frontend/${name}`)
roots.push('docs/legal', 'nova', 'backend', 'Dockerfile', '.dockerignore', 'deploy/docker-entrypoint.sh')
mkdirSync(dirname(output), { recursive: true })
const excludedDirectories = new Set(['node_modules', 'dist', 'out', '.next', 'coverage', 'nova-images', '.git'])
const excludedPaths = []
function collect(relative) {
  const name = relative.split('/').at(-1)
  if (excludedDirectories.has(name) || name === 'model-plaza-source.tar.gz' || /\.sqlite(?:[.-]|$)/.test(name)
      || (/^\.env(?:\.|$)/.test(name) && !name.endsWith('.example'))) {
    excludedPaths.push(relative)
    return
  }
  const absolute = resolve(dirname(frontend), relative)
  if (statSync(absolute).isDirectory()) {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) excludedPaths.push(`${relative}/${entry.name}`)
      else collect(`${relative}/${entry.name}`)
    }
  }
}
roots.forEach(collect)
const result = spawnSync('tar', [
  '-czf', output, ...excludedPaths.map(path => `--exclude=${path}`),
  '-C', dirname(frontend), ...roots
], { stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`Source archive failed: ${result.status}`)
console.log('Model plaza corresponding source: public/model-plaza-source.tar.gz')
