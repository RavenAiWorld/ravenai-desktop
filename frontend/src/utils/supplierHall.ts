import type { ModelHealthProviderGroup, ModelHealthProviderMetrics, ModelHealthProviderModel } from '@/api/admin/modelHealth'

export type SupplierMetric = 'rank' | 'rate' | 'effective' | 'cost' | 'firstToken' | 'speed' | 'success' | 'cache' | 'samples' | 'rating' | 'models'
export const supplierMetrics: SupplierMetric[] = ['rank', 'rate', 'effective', 'cost', 'firstToken', 'speed', 'success', 'cache', 'samples', 'rating', 'models']
export const supplierComparisons = { lt: '<', lte: '\u2264', eq: '=', gte: '\u2265', gt: '>' } as const
export interface SupplierMetricFilter {
  metric: SupplierMetric
  comparison: keyof typeof supplierComparisons
  threshold: number
  mode: 'keep' | 'exclude'
}

const percentMetrics = new Set<SupplierMetric>(['success', 'cache'])
const supplierFilterUnits: Partial<Record<SupplierMetric, string>> = {
  success: '%', cache: '%', firstToken: 'ms', speed: 'TPS', cost: 'CNY/M', rate: '\u00d7', effective: '\u00d7', rating: '/ 5',
}

export function supplierMetricInput(metric: SupplierMetric) {
  return { unit: supplierFilterUnits[metric], max: percentMetrics.has(metric) ? 100 : metric === 'rating' ? 5 : undefined }
}

export function matchesSupplierMetricFilter(value: number | null, filter: SupplierMetricFilter) {
  const threshold = percentMetrics.has(filter.metric) ? filter.threshold / 100 : filter.threshold
  let hit = false
  if (value != null && Number.isFinite(value)) {
    switch (filter.comparison) {
      case 'lt': hit = value < threshold; break
      case 'lte': hit = value <= threshold; break
      case 'eq': hit = value === threshold; break
      case 'gte': hit = value >= threshold; break
      case 'gt': hit = value > threshold; break
    }
  }
  return filter.mode === 'exclude' ? !hit : hit
}

export const supplierPlatformLabels: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Claude', gemini: 'Gemini', deepseek: 'DeepSeek',
  grok: 'Grok', kimi: 'Kimi', zhipu: 'GLM',
}
export function supplierRank(group: ModelHealthProviderGroup, now: number) {
  const badge = group.popularity
  return badge && badge.window === '24h' && badge.status === 'measured' && badge.rank > 0 &&
    Date.parse(badge.expires_at) > now ? badge : undefined
}
export function supplierScopedMetrics(group: ModelHealthProviderGroup | undefined, model: string, stale: boolean) {
  if (stale || !group) return undefined
  return model ? group.model_metrics?.[model] : group.metrics
}

export function supplierEffectiveMultiplier(stats: ModelHealthProviderMetrics | undefined, now: number) {
  if (stats?.effective_multiplier_expires_at && !(Date.parse(stats.effective_multiplier_expires_at) > now)) return null
  return stats?.effective_multiplier ?? null
}

export function supplierMetric(group: ModelHealthProviderGroup, model: string, metric: SupplierMetric, now: number, stale: boolean): number | null {
  if (metric === 'rank') return supplierRank(group, now)?.rank ?? null
  if (metric === 'rate') return group.rate_multiplier
  if (metric === 'rating') return group.stars ?? null
  if (metric === 'models') return group.catalog_known ? group.supported_models?.length ?? 0 : null
  const stats = supplierScopedMetrics(group, model, stale)
  if (!stats) return null
  switch (metric) {
    case 'effective': return supplierEffectiveMultiplier(stats, now)
    case 'cost': return stats.input_price_per_million
    case 'firstToken': return stats.duration_ms
    case 'speed': return stats.tps
    case 'success': return stats.success_rate
    case 'cache': return stats.cache_hit_rate
    case 'samples': return stats.sample_count
  }
}
export function compareSupplierMetric(a: number | null, b: number | null, ascending: boolean) {
  if (a == null || !Number.isFinite(a)) return b == null || !Number.isFinite(b) ? 0 : 1
  if (b == null || !Number.isFinite(b)) return -1
  return ascending ? a - b : b - a
}

export function formatSupplierMetric(value: number | null | undefined, key: SupplierMetric, locale: string) {
  if (value == null || !Number.isFinite(value)) return '\u2014'
  const number = (n: number, digits: number) => n.toLocaleString(locale, { maximumFractionDigits: digits })
  if (key === 'rank') return `#${value}`
  if (key === 'rate' || key === 'effective') return `${number(value, 3)}\u00d7`
  if (key === 'cost') return `\u00a5${number(value, 3)}`
  if (key === 'firstToken') return `${number(value, 0)} ms`
  if (key === 'success' || key === 'cache') return `${number(value * 100, 1)}%`
  return number(value, key === 'samples' || key === 'models' ? 0 : key === 'rating' ? 2 : 1)
}

export function supplierHallVisible(item: ModelHealthProviderGroup) {
  return item.visible_in_hall ?? item.available === true
}

export function supplierCardHealth(card: ModelHealthProviderModel, now: number) {
  if (card.probe_state && card.probe_state !== 'enabled') return 'unknown'
  const known = (health: string) => health === 'healthy' || health === 'failed' ? health : 'unknown'
  let health = card.health
  if (Date.parse(card.health_expires_at ?? '') > now) return known(health)
  // A transition is valid up to the next scheduled step, never indefinitely.
  for (const step of card.health_timeline ?? []) {
    const at = Date.parse(step.at)
    if (!Number.isFinite(at)) return 'unknown'
    if (at > now) return known(health)
    health = step.health
  }
  return 'unknown'
}

export function supplierAvailability(item: ModelHealthProviderGroup, catalogStale: boolean, now: number) {
  if (catalogStale) return 'unknown'
  let failed = false
  for (const card of item.models ?? []) {
    const health = supplierCardHealth(card, now)
    if (health === 'healthy') return 'available'
    if (health === 'failed') failed = true
  }
  return failed ? 'unavailable' : 'unknown'
}

export interface SupplierPlatformCount { visible: number; available: number; pending: number }
export function supplierPlatformCounts(items: ModelHealthProviderGroup[], blocked: ReadonlySet<number>, now: number) {
  const counts = new Map<string, SupplierPlatformCount>()
  for (const item of items) {
    if (!supplierHallVisible(item) || blocked.has(item.group_id)) continue
    const count = counts.get(item.platform) ?? { visible: 0, available: 0, pending: 0 }
    count.visible++
    const status = supplierAvailability(item, false, now)
    if (status === 'available') count.available++
    if (status === 'unknown') count.pending++
    counts.set(item.platform, count)
  }
  return counts
}
