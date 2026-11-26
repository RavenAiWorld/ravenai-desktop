import { describe, expect, it } from 'vitest'

import type { OpsDashboardOverview, OpsJobHeartbeat } from '@/api/admin/ops'
import { formatMemorySizeMB, formatOpsRate, getOpsHealthScore, getOpsJobHealth, getOpsJobsStatus, hasOpsTraffic } from '../opsFormatters'

describe('formatMemorySizeMB', () => {
  it('keeps capacities below one GiB in MB', () => {
    expect(formatMemorySizeMB(61)).toBe('61 MB')
    expect(formatMemorySizeMB(1023)).toBe('1023 MB')
  })

  it('converts capacities at or above one GiB to GB', () => {
    expect(formatMemorySizeMB(1024)).toBe('1 GB')
    expect(formatMemorySizeMB(1536)).toBe('1.5 GB')
    expect(formatMemorySizeMB(32768)).toBe('32 GB')
  })

  it('handles zero and invalid values without producing a misleading unit', () => {
    expect(formatMemorySizeMB(0)).toBe('0 MB')
    expect(formatMemorySizeMB(-1)).toBe('-')
    expect(formatMemorySizeMB(Number.NaN)).toBe('-')
    expect(formatMemorySizeMB(Number.POSITIVE_INFINITY)).toBe('-')
    expect(formatMemorySizeMB(null)).toBe('-')
    expect(formatMemorySizeMB(undefined)).toBe('-')
  })
})

describe('ops health and rate semantics', () => {
  function overview(fields: Partial<OpsDashboardOverview> = {}): OpsDashboardOverview {
    return { request_count_total: 0, request_count_sla: 0, error_count_total: 0,
      qps: { current: 0, avg: 0, peak: 0 }, health_score: 100, ...fields } as OpsDashboardOverview
  }

  function heartbeat(fields: Partial<OpsJobHeartbeat> = {}): OpsJobHeartbeat {
    return { job_name: 'job', updated_at: '2026-09-24T00:00:00Z', ...fields }
  }

  it('does not round low traffic to zero', () => {
    expect(formatOpsRate(0.026)).toBe('0.026')
    expect(formatOpsRate(1 / 60)).toBe('0.017')
    expect(formatOpsRate(1 / 86400)).toBe('<0.001')
    expect(formatOpsRate(0)).toBe('0.0')
    expect(formatOpsRate(12.34)).toBe('12.3')
    expect(formatOpsRate(undefined)).toBe('-')
    expect(formatOpsRate(Number.NaN)).toBe('-')
    expect(formatOpsRate(-1)).toBe('-')
  })

  it('keeps a populated window active when the current minute is empty', () => {
    expect(hasOpsTraffic(overview())).toBe(false)
    expect(hasOpsTraffic(overview({ request_count_total: 2204 }))).toBe(true)
    expect(hasOpsTraffic(overview({ error_count_total: 1 }))).toBe(true)
    expect(hasOpsTraffic(null)).toBe(false)
  })

  it('never labels a missing latency query as a perfect health score', () => {
    expect(getOpsHealthScore(overview({ health_score_status: 'unknown' }))).toBeNull()
    expect(getOpsHealthScore(overview({ latency_status: 'timeout' }))).toBeNull()
    expect(getOpsHealthScore(overview({ health_score_status: 'ok', health_score: 73 }))).toBe(73)
    expect(getOpsHealthScore(null)).toBeNull()
  })

  it('uses backend schedule-aware job states and excludes disabled jobs', () => {
    expect(getOpsJobsStatus([heartbeat({ health_status: 'healthy' }), heartbeat({ health_status: 'disabled' })])).toBe('ok')
    expect(getOpsJobsStatus([heartbeat({ health_status: 'stale' })])).toBe('warn')
    expect(getOpsJobsStatus([heartbeat({ health_status: 'failed' })])).toBe('warn')
    expect(getOpsJobsStatus([heartbeat({ health_status: 'unknown' })])).toBe('unknown')
    expect(getOpsJobsStatus([heartbeat({ health_status: 'disabled' })])).toBe('unknown')
    expect(getOpsJobsStatus([])).toBe('unknown')
  })

  it('does not fabricate stale states for legacy or never-run jobs', () => {
    expect(getOpsJobHealth(heartbeat())).toBe('unknown')
    expect(getOpsJobHealth(heartbeat({ last_success_at: '2026-09-20T00:00:00Z' }))).toBe('healthy')
    expect(getOpsJobHealth(heartbeat({ last_error_at: '2026-09-24T00:00:00Z' }))).toBe('failed')
  })
})
