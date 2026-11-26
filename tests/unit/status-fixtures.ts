import type { ModelPlazaGroup, PlazaModel, PlazaRouteStats } from '../../client/pricing/modelPlaza'

export const NOW = Date.parse('2026-11-26T07:00:00Z')
export function stats(extra: Partial<PlazaRouteStats> = {}): PlazaRouteStats {
  return { updated_at: new Date(NOW).toISOString(), stale: false, group_average: false,
    history: Array(24).fill('operational'), success_rate: .99, latency_ms: 1200, ...extra }
}
export function model(name: string, metrics: PlazaRouteStats | undefined = stats()): PlazaModel {
  return { name, platform: 'openai', pricing: null, official_pricing: null, route_stats: metrics }
}
export function group(id = 1, extra: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return { id, name: `Public ${id}`, status: 'active', platform: 'openai', description: '', subscription_type: 'standard',
    rate_multiplier: 1, peak_rate_enabled: false, peak_start: '', peak_end: '', peak_rate_multiplier: 1,
    is_exclusive: false, image_rate_independent: false, image_rate_multiplier: 1, video_rate_independent: false,
    video_rate_multiplier: 1, long_context_pricing_enabled: false, models: [model('gpt')], ...extra }
}
