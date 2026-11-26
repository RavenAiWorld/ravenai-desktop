const reportStates = ['passed', 'suspected', 'failed', 'stale'] as const
const stageKeys = ['detection', 'text', 'image'] as const
const effortTokens = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export type ModelTraceStatus = typeof reportStates[number]
export type ModelTraceStageKey = typeof stageKeys[number]

export interface ModelTraceStage {
  key: ModelTraceStageKey
  model: string
  reasoning_effort?: string
}

export interface ModelTraceTextTest {
  question?: string
  answer?: string
  result_label?: string
  passed?: boolean
}

export interface ModelTraceImageTest {
  url?: string
  title?: string
  generated_at?: string
}

export interface ModelTraceReport {
  id: string
  status: ModelTraceStatus
  completed_at: string
  expires_at: string
  stages: ModelTraceStage[]
  text?: ModelTraceTextTest
  image?: ModelTraceImageTest
}

export type ModelTraceHistoryStatus = ModelTraceStatus

export interface ModelTraceHistoryItem {
  id: string
  status: ModelTraceHistoryStatus
  completed_at: string
  expired?: boolean
}

export interface ModelTraceSnapshot {
  server_time: string
  report?: ModelTraceReport
  history: ModelTraceHistoryItem[]
}

const unsafeLabelStructure = /\/\/|\b(?:https?|ftp|file|mailto|javascript|data):\S|\b(?:[a-z0-9-]+\.)+[a-z]{2,63}\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|[<>\p{Cc}\p{Cf}]/iu
const unsafeBodyStructure = /\/\/|\b(?:https?|ftp|file|mailto|javascript|data):\S|\b(?:[a-z0-9-]+\.)+[a-z]{2,63}\b|\b(?:\d{1,3}\.){3}\d{1,3}\b|<[a-zA-Z!/]/iu
const publicModelIDMaxLength = 200
const modelID = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/
const reportIDPattern = /^[0-9a-f]{32}$/
const proxyImagePath = /^\/api\/v1\/model-trace\/reports\/([0-9a-f]{32})\/stages\/image$/
const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/

// Retention starts at completion; expires_at only describes evidence freshness.
export function modelTraceRetainedUntil(completedAt: string): number {
  return Date.parse(completedAt) + 24 * 60 * 60 * 1000
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function choice<T extends string>(choices: readonly T[], value: unknown): T | undefined {
  return typeof value === 'string' ? choices.find(item => item === value) : undefined
}

function utc(value: unknown): string | undefined {
  return typeof value === 'string' && isoInstant.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined
}

function capRunes(value: string, maxRunes: number): string {
  const chars = Array.from(value)
  if (chars.length <= maxRunes) return value
  return chars.slice(0, maxRunes - 1).join('').trimEnd() + '…'
}

function localLabel(value: unknown, maxRunes = 200): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed || unsafeLabelStructure.test(trimmed.normalize('NFKC'))) return ''
  return capRunes(trimmed, maxRunes)
}

function safeBodyText(value: unknown, maxRunes: number): string {
  if (typeof value !== 'string') return ''
  const normalized = value.replace(/\r\n?/g, '\n').replace(/[^\S\n\t\u0020\u00A0\u3000]/g, '')
  const stripped = Array.from(normalized).filter(ch => {
    if (ch === '\n' || ch === '\t') return true
    return !/[\p{Cc}\p{Cf}]/u.test(ch)
  }).join('').trim()
  if (!stripped || unsafeBodyStructure.test(stripped.normalize('NFKC'))) return ''
  return capRunes(stripped, maxRunes)
}

function readStage(value: unknown): ModelTraceStage | undefined {
  const row = object(value)
  const key = choice(stageKeys, row?.key)
  if (!key || typeof row?.model !== 'string' || row.model.length > publicModelIDMaxLength ||
      !modelID.test(row.model) || !localLabel(row.model)) return
  const effort = choice(effortTokens, typeof row.reasoning_effort === 'string' ? row.reasoning_effort.toLowerCase().trim() : undefined)
  return effort ? { key, model: row.model, reasoning_effort: effort } : { key, model: row.model }
}

function readText(value: unknown): ModelTraceTextTest | undefined {
  const row = object(value)
  if (!row) return
  const question = safeBodyText(row.question, 4000) || undefined
  const answer = safeBodyText(row.answer, 2000) || undefined
  const result_label = localLabel(row.result_label, 32) || undefined
  const passed = typeof row.passed === 'boolean' ? row.passed : undefined
  if (!question && !answer && !result_label && passed === undefined) return
  return {
    ...(question ? { question } : {}),
    ...(answer ? { answer } : {}),
    ...(result_label ? { result_label } : {}),
    ...(passed !== undefined ? { passed } : {})
  }
}

function readImage(value: unknown, reportId: string): ModelTraceImageTest | undefined {
  const row = object(value)
  if (!row) return
  let url: string | undefined
  if (typeof row.url === 'string') {
    const match = proxyImagePath.exec(row.url)
    if (match && match[1] === reportId) {
      url = row.url
    }
  }
  const title = localLabel(row.title, 200) || undefined
  const generated_at = utc(row.generated_at)
  if (!url && !title && !generated_at) return
  return {
    ...(url ? { url } : {}),
    ...(title ? { title } : {}),
    ...(generated_at ? { generated_at } : {})
  }
}

function readReport(value: unknown, serverTime: string): ModelTraceReport | undefined {
  const row = object(value)
  if (!row || typeof row.id !== 'string' || !reportIDPattern.test(row.id)) return
  const status = choice(reportStates, row.status)
  const completed_at = utc(row.completed_at)
  const expires_at = utc(row.expires_at)
  const reference = Date.parse(serverTime)
  if (!status || !completed_at || !expires_at) return
  if (Date.parse(completed_at) > reference + 30_000) return
  if (reference >= modelTraceRetainedUntil(completed_at)) return
  if (Date.parse(expires_at) > Date.parse(completed_at) + 21_600_000) return

  const stages: ModelTraceStage[] = []
  if (row.stages !== undefined) {
    if (!Array.isArray(row.stages) || row.stages.length > stageKeys.length) return
    for (const item of row.stages) {
      const stage = readStage(item)
      if (!stage || stages.some(other => other.key === stage.key)) return
      stages.push(stage)
    }
    stages.sort((a, b) => stageKeys.indexOf(a.key) - stageKeys.indexOf(b.key))
  }
  const text = readText(row.text)
  const image = readImage(row.image, row.id)
  return {
    id: row.id,
    status,
    completed_at,
    expires_at,
    stages,
    ...(text ? { text } : {}),
    ...(image ? { image } : {})
  }
}

function readHistory(value: unknown, serverTime: string): ModelTraceHistoryItem[] {
  if (!Array.isArray(value)) return []
  const reference = Date.parse(serverTime)
  const seen = new Set<string>()
  const items: ModelTraceHistoryItem[] = []
  for (const entry of value) {
    const row = object(entry)
    const status = choice(reportStates, row?.status)
    const completed_at = utc(row?.completed_at)
    if (typeof row?.id !== 'string' || !reportIDPattern.test(row.id) || !status || !completed_at) continue
    if (seen.has(row.id)) continue
    const completed = Date.parse(completed_at)
    if (completed > reference + 30_000 || reference >= modelTraceRetainedUntil(completed_at)) continue
    seen.add(row.id)
    items.push({ id: row.id, status, completed_at, ...(row.expired === true ? { expired: true } : {}) })
    if (items.length >= 240) break
  }
  items.sort((a, b) => Date.parse(b.completed_at) - Date.parse(a.completed_at))
  return items
}

export function decodeModelTrace(value: unknown): ModelTraceSnapshot {
  const row = object(value)
  const server_time = utc(row?.server_time)
  if (!server_time) throw new Error('Invalid report response')
  const history = readHistory(row?.history, server_time)
  if (row?.report === undefined || row.report === null) {
    return { server_time, history }
  }
  const report = readReport(row.report, server_time)
  return report ? { server_time, report, history } : { server_time, history }
}
