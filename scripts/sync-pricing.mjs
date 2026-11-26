import fs from 'node:fs'
import path from 'node:path'

// Pure production pricing modules; no website runtime or authentication is bundled.
const mappings = [
  ['components/modelPlaza/plazaCatalog.ts', 'catalog.ts'],
  ['utils/pricing.ts', 'pricing.ts'],
  ['constants/channel.ts', 'channel.ts'],
  ['api/channels.ts', 'channels.ts'],
  ['api/modelPlaza.ts', 'modelPlaza.ts'],
]
fs.mkdirSync('client/pricing', { recursive: true })
for (const [source, target] of mappings) {
  let text = fs.readFileSync(path.join('frontend/src', source), 'utf8')
  text = text.replaceAll("'@/api/modelPlaza'", "'./modelPlaza'")
    .replaceAll("'@/api/channels'", "'./channels'")
    .replaceAll("'@/constants/channel'", "'./channel'")
    .replaceAll("'@/utils/pricing'", "'./pricing'")
    .replace("import { apiClient } from './client'", '')
    .replace("import type { GroupStatus } from '@/types'", "type GroupStatus = 'active' | 'inactive' | 'maintenance'")
  if (source.startsWith('api/')) text = text.slice(0, text.indexOf('export async function'))
  fs.writeFileSync(path.join('client/pricing', target), text)
}
