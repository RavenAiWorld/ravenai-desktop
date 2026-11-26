import type { ModelPlazaGroup, PlazaModel, PlazaRouteStats } from '../pricing/modelPlaza'
import { isPlazaGroupVisible } from '../pricing/catalog'

export type ChannelState = 'operational' | 'degraded' | 'failed' | 'maintenance' | 'unknown'
export type HistoryState = Exclude<ChannelState, 'maintenance'>
export const SNAPSHOT_MAX_AGE_MS = 15 * 60_000
export const HISTORY_SLOT_MS = 15 * 60_000

export function snapshotFresh(stats: PlazaRouteStats | undefined, now: number): boolean {
  const at = Date.parse(stats?.updated_at ?? '')
  return !!stats && !stats.stale && Number.isFinite(at) && at <= now + 60_000 && now - at <= SNAPSHOT_MAX_AGE_MS
}

export function historyState(value: unknown): HistoryState {
  return value === 'operational' || value === 'degraded' || value === 'failed' ? value : 'unknown'
}

// Mixed failures describe partial service loss; missing observations never count as success.
export function combineStates(states: HistoryState[]): HistoryState {
  if (!states.length) return 'unknown'
  if (states.every(state => state === 'failed')) return 'failed'
  if (states.some(state => state === 'failed' || state === 'degraded')) return 'degraded'
  if (states.some(state => state === 'unknown')) return 'unknown'
  return 'operational'
}

export function modelState(model: PlazaModel, group: ModelPlazaGroup, now: number): ChannelState {
  if (group.status === 'maintenance') return 'maintenance'
  if (!snapshotFresh(model.route_stats, now)) return 'unknown'
  return historyState(model.route_stats?.history.at(-1))
}

export function buildChannelRows(groups: ModelPlazaGroup[], now: number) {
  return groups.filter(group => isPlazaGroupVisible(group) && group.status !== 'inactive').map(group => {
    const monitored = group.models.filter(model => model.route_stats)
    const times = monitored.map(model => Date.parse(model.route_stats!.updated_at)).filter(Number.isFinite)
    const updatedAt = times.length ? Math.max(...times) : null
    const history = Array.from({ length: 24 }, (_, index) => combineStates(monitored.map(model => {
      const stats = model.route_stats!
      // Do not combine cells from differently dated snapshots as if they shared a window.
      return updatedAt !== null && Math.abs(Date.parse(stats.updated_at) - updatedAt) < 60_000
        ? historyState(stats.history[index]) : 'unknown'
    })))
    const state: ChannelState = group.status === 'maintenance' ? 'maintenance'
      : combineStates(monitored.map(model => modelState(model, group, now) as HistoryState))
    const latencies = monitored.filter(model => snapshotFresh(model.route_stats, now))
      .map(model => model.route_stats?.latency_ms).filter((value): value is number => value != null && Number.isFinite(value) && value > 0)
    const tpsList = monitored.filter(model => snapshotFresh(model.route_stats, now))
      .map(model => model.route_stats?.tps).filter((value): value is number => value != null && Number.isFinite(value) && value > 0)
    const known = history.filter(value => value !== 'unknown')
    return {
      group, monitored: monitored.length, state, history, updatedAt,
      fresh: monitored.length > 0 && monitored.every(model => snapshotFresh(model.route_stats, now)),
      latencyMin: latencies.length ? Math.min(...latencies) : null,
      latencyMax: latencies.length ? Math.max(...latencies) : null,
      latencySamples: latencies,
      latencyMedian: median(latencies),
      tpsSamples: tpsList,
      tpsMedian: median(tpsList),
      coverage: known.length,
      healthyShare: known.length ? known.filter(state => state === 'operational').length / known.length : null,
    }
  })
}

export type ChannelRow = ReturnType<typeof buildChannelRows>[number]

export function median(values: number[]): number | null {
  const ordered = values.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b)
  if (!ordered.length) return null
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

export function monitoringShare(rows: ChannelRow[], slots = 24): number | null {
  const observed = rows.filter(row => row.fresh).flatMap(row => row.history.slice(-slots)).filter(state => state !== 'unknown')
  return observed.length ? observed.filter(state => state === 'operational').length / observed.length : null
}

export function bucketHistory(history: HistoryState[], hourly: boolean): HistoryState[] {
  if (!hourly) return history
  return Array.from({ length: 6 }, (_, index) => combineStates(history.slice(index * 4, index * 4 + 4)))
}

export function filterChannelRows(rows: ChannelRow[], query: string, state: string, platform: string) {
  const needle = query.trim().toLowerCase()
  return rows.filter(row => (state === 'all' || row.state === state) && (platform === 'all' || row.group.platform === platform)
    && (!needle || [row.group.name, row.group.platform, ...row.group.models.map(model => model.name)]
      .some(value => value.toLowerCase().includes(needle))))
}
