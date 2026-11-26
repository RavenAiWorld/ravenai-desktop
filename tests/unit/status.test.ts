import { describe, expect, it } from 'vitest'
import { bucketHistory, buildChannelRows, filterChannelRows, median, monitoringShare, modelState, SNAPSHOT_MAX_AGE_MS } from '../../client/status/statusData'
import { NOW, group, model, stats } from './status-fixtures'

describe('channel status snapshots', () => {
  it('summarizes observed model latencies and excludes missing or stale intervals', () => {
    expect(median([100, 500, 300, NaN, -1])).toBe(300)
    expect(median([100, 500])).toBe(300)
    expect(median([])).toBeNull()
    const rows = buildChannelRows([group(1, { models: [model('gpt', stats({ latency_ms: 1200, tps: 68.5, history: [...Array(20).fill(''), 'operational', 'failed', 'operational', ''] }))] }),
      group(2, { models: [model('stale', stats({ stale: true, latency_ms: 9999, tps: 999 }))] })], NOW)
    expect(rows[0].latencySamples).toEqual([1200])
    expect(rows[0].latencyMedian).toBe(1200)
    expect(rows[0].tpsSamples).toEqual([68.5])
    expect(rows[0].tpsMedian).toBe(68.5)
    expect(rows[1].latencySamples).toEqual([])
    expect(rows[1].tpsSamples).toEqual([])
    expect(monitoringShare(rows)).toBeCloseTo(2 / 3)
    expect(monitoringShare(rows, 2)).toBe(1)
    expect(monitoringShare([rows[1]])).toBeNull()
  })
  it('never counts missing, stale, expired, or future-dated samples as operational', () => {
    const g = group()
    for (const metrics of [undefined, stats({ stale: true }), stats({ updated_at: new Date(NOW - SNAPSHOT_MAX_AGE_MS - 1).toISOString() }),
      stats({ updated_at: new Date(NOW + 120000).toISOString() }), stats({ history: [...Array(23).fill('operational'), ''] })]) {
      const m = { ...model('gpt'), route_stats: metrics }
      expect(modelState(m, g, NOW)).toBe('unknown')
      expect(buildChannelRows([{ ...g, models: [m] }], NOW)[0].state).toBe('unknown')
    }
  })
  it('keeps explicit maintenance visible even with no models and hides inactive or administrative groups', () => {
    const rows = buildChannelRows([group(1, { status: 'maintenance', models: [] }), group(2, { status: 'inactive' }), group(3, { name: 'Admin only' })], NOW)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ state: 'maintenance', monitored: 0, healthyShare: null })
  })
  it('distinguishes partial failure from complete failure without fabricating an overall success rate', () => {
    const failed = model('bad', stats({ history: Array(24).fill('failed') }))
    expect(buildChannelRows([group(1, { models: [failed, model('good')] })], NOW)[0].state).toBe('degraded')
    expect(buildChannelRows([group(1, { models: [failed] })], NOW)[0].state).toBe('failed')
  })
  it('counts only observed intervals and reports explicit model coverage', () => {
    const g = group(1, { models: [model('gpt', stats({ history: [...Array(22).fill(''), 'failed', 'operational'] })),
      { ...model('image'), route_stats: undefined }] })
    expect(buildChannelRows([g], NOW)[0]).toMatchObject({ monitored: 1, coverage: 2, healthyShare: .5 })
  })
  it('does not combine histories with different time windows', () => {
    const g = group(1, { models: [model('gpt'), model('other', stats({ updated_at: new Date(NOW - 900000).toISOString() }))] })
    expect(buildChannelRows([g], NOW)[0].history).toEqual(Array(24).fill('unknown'))
  })
  it('aggregates hourly observations conservatively and filters by model, provider, and state', () => {
    expect(bucketHistory(['operational', 'operational', 'failed', 'operational', ...Array(20).fill('unknown')], true)[0]).toBe('degraded')
    const rows = buildChannelRows([group(1), group(2, { platform: 'anthropic', status: 'maintenance' })], NOW)
    expect(filterChannelRows(rows, 'GPT', 'operational', 'openai')).toHaveLength(1)
    expect(filterChannelRows(rows, '', 'maintenance', 'anthropic')[0].group.id).toBe(2)
    expect(filterChannelRows(rows, 'missing', 'all', 'all')).toHaveLength(0)
  })
})
